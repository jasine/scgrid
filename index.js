const fs = require('fs');
const request = require('request-promise-native');
const Cookie = require('tough-cookie').Cookie;
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('./user');

const appid = process.env.GRID_APPID ? process.env.GRID_APPID : 'test';
const basePath = process.env.GRID_PATH ? process.env.GRID_PATH : 'https://api.cngrid.net/v2';
const jobPath = `${basePath}/jobs`

var testPath = 'http://api.scgrid.cn/v2/job';

let storeConnected = false;

const jobStateCode = {
    '1': 'SUBMITTED',
    '2': 'STAGINGIN',
    '4': 'SCHEDULING',
    '8': 'SCHEDULED',
    '16': 'PENDING',
    '17': 'RUNNING',
    '18': 'STAGINGOUT',
    '20': 'FINISHED',
    '24': 'FAILED',
    '32': 'TERMINATED',
    '33': 'NET_DELAY',
    '34': 'SUB_ERROR',
    '38': 'EXIT'
};

getStatusCode = (code) => {
    return jobStateCode[code] || 'UNKNOWN_RESULT'
}

async function createStore(db = process.env.DBURL) {
    mongoose.connect(db, {
        server: {
            socketOptions: {
                keepAlive: 1
            }
        },
        auto_reconnect: true
    });
    return new Promise((resolve, reject) => {
        mongoose.connection.on('connected', function () {
            storeConnected = true;
            console.log('✔ MongoDB Connection Success!');
            resolve('success');
        });

        mongoose.connection.on('error', function (err) {
            throw '✗ MongoDB Connection Error. Please make sure MongoDB is running.';
            reject(err);
        });
    })

}



const users = new Map();

class ScGrid {
    constructor(username) {
        this.username = username;
    };



    async sign(path, method, options) {
        if (!this.user) {
            if (storeConnected) { // use mongo store
                this.user = (await User.find({ name: this.username }))[0];
                if (!this.user) {
                    this.user = new User({
                        name: this.username
                    });
                }
            } else {// use memory store
                if (users.has(this.username)) {
                    this.user = users.get(this.username)
                } else {
                    this.user = {
                        name: this.username
                    };
                    users.set(this.username, this.user);
                }
            }

        }

        let reqStr = method + path;
        const arr = Object.keys(options).sort();
        for (let item in arr) {
            if (item) {
                reqStr = reqStr + arr[item] + '=' + options[arr[item]];
            }
        }
        if (this.user.keys) {
            reqStr = reqStr + this.user.keys.md5secret;
        }
        return crypto.createHash('md5').update(reqStr).digest('hex');
    };

    async sendRequest(options, parameters = {}, isDownload = false) {
        parameters.timestamp = Date.now();
        parameters.md5sum = await this.sign(options.url, options.method, parameters);
        const j = request.jar();

        if (this.user.cookies) {
            this.user.cookies.forEach(cookie => j.setCookie(Cookie.fromJSON(cookie), options.url));
        }

        let temp = '';
        for (let item in parameters) {
            temp = temp + item + '=' + parameters[item] + '&';
        }
        temp = temp.substring(0, temp.length - 1);
        options.url = `${options.url}?${temp}`;
        options.jar = j;
        options.strictSSL = false;
        options.headers['user-agent'] = 'Mozilla/5.0 (Windows NT 5.1; rv:24.0) Gecko/20100101 Firefox/24.0';
        if (isDownload) {
            return await request(options);
        } else {
            try {
                const res = await request(options);
                const cookies_new = j.getCookies(options.url);
                const cookieArray = [];
                cookies_new.forEach(function (cookie) {
                    cookieArray.push(JSON.stringify(cookie.toJSON()));
                });
                try {
                    let result = res;
                    if (typeof (res) !== 'object') {
                        result = JSON.parse(res);
                    }
                    if (result.status_code !== 0) {
                        return Promise.reject(result);
                    }
                    this.user.cookies = cookieArray;
                    if (storeConnected) {
                        await this.user.save();
                    }
                    return result;
                } catch (error) {
                    return Promise.reject(error);
                }
                return res;
            } catch (err) {
                return Promise.reject(JSON.parse(err.error));
            }

        }
    };

    async login(password, remember = true, validtime = 10) {
        const form = {
            appid,
            username: this.username,
            password,
            remember,
            validtime,
        };
        const options = {
            url: `${basePath}/users/login`,
            method: 'POST',
            form: form,
            headers: {
                'accept': 'application/json',
            }
        };
        const res = await this.sendRequest(options);
        this.user.keys = res;
        if (storeConnected) {
            await this.user.save();
        }
        return res;
    };

    async loginOAuth(openid, token) {
        const form = {
            appid,
            openid,
            token,
        };
        const options = {
            url: `${basePath}/users/login/openid`,
            method: 'POST',
            form,
            headers: {
                'accept': 'application/json',
            }
        };
        return await this.sendRequest(options);
    };

    async logout() {
        const options = {
            url: `${basePath}/users/logout`,
            method: 'GET',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'accept': 'application/json',
            }
        };

        const parameters = {
            'appid': appid,
            'forget': true,
        };

        return await this.sendRequest(options, parameters);

    };

    async calcList(appname) {
        const options = {
            url: `${basePath}/resources/applications/${appname}`,
            method: 'GET',
            formData: {},
            headers: {
                'Content-Type': 'multipart/form-data',
                'accept': '*/*',
            }
        };
        return await this.sendRequest(options);
    };

    async fileList(gid) {
        const options = {
            url: `${basePath}/data/jobs/${gid}/list`,
            method: 'GET',
            headers: {
                'accept': 'application/json',
            }
        };
        const result = await this.sendRequest(options);
        const files = [];
        for (let i = 1; i < result.items.length; i++) {
            const arr = result.items[i].split(/\s+/);
            files.push({
                name: arr[7],
                time: `${arr[5]} ${arr[6]}`
            })

        }
        return files;
    };

    async changeJobStatue(gid, statue) {
        const options = {
            url: `${jobPath}/${gid}/status`,
            method: 'PUT',
            headers: {
                'accept': 'application/json',
            }
        };
        const parameters = {
            job_status: statue
        };

        return await this.sendRequest(options, parameters);
    };

    async jobStatue(gid, callback) {
        const options = {
            url: `${jobPath}/${gid}/status`,
            method: 'GET',
            headers: {
                'accept': 'application/json',
            }
        };

        const result = await this.sendRequest(options);
        return getStatusCode(result.job_status);
    };

    async deleteJob(gid) {
        const options = {
            url: `${jobPath}/${gid}`,
            method: 'DELETE',
            headers: {
                'accept': 'application/json',
            }
        };

        return await this.sendRequest(options);
    };

    async jobInfo(gid) {
        const options = {
            url: `${jobPath}/${gid}`,
            method: 'GET',
            headers: {
                'accept': 'application/json',
            }
        };
        return (await this.sendRequest(options)).job;
    };

    async submitTask(dataOption) {
        const options = {
            url: jobPath,
            method: 'POST',
            body: dataOption,
            json: true,
            headers: {
                'Content-Type': 'application/json',
                'accept': 'application/json',
            }
        };
        return (await this.sendRequest(options)).gidujid;
    }

    async jobList() {
        const options = {
            url: jobPath,
            method: 'GET',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'accept': 'application/json',
            }
        };

        const parameters = {
            'order': 'ID'
        };

        return (await this.sendRequest(options, parameters)).jobs_list;
    };

    async refresh() {
        const options = {
            url: jobPath + gid,
            method: 'GET',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'accept': 'application/json',
            }
        };

        const parameters = {
            'order': 'ID'
        };
        return await this.sendRequest(options, parameters);
    };

    async download(gid, file) {
        const options = {
            url: `${basePath}/data/jobs/${gid}/mcp/${file}`,
            method: 'GET',
            encoding: null,
            headers: {}
        };

        const parameters = {
            location: 'l'
        }

        return await this.sendRequest(options, parameters, true);
    };

    async upload(gid, file) {
        const formData = {
            my_file: fs.createReadStream(file),
        };
        const options = {
            url: `${basePath}/data/jobs/${gid}/cs`,
            method: 'POST',
            formData: formData,
            headers: {
                'Content-Type': 'multipart/form-data',
                'accept': '*/*',
            }
        };
        return (await this.sendRequest(options)).files[0];
    };

}


module.exports = {
    createStore,
    ScGrid,
};