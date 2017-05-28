# ScGrid SDK
## Init
load `const scgrid=require('scgrid');`

store with mongoDB: `await scgrid.createStore('mongodb://localhost:27017/db');`

**If not store with mongoDB, data will be store in memory and will lost after program restart**

## Usage

* create instance `const instance = new scgrid.ScGrid('username');`
* method available on instance, e.g. `await instance.login(password)`
* all methods return a Promise

## API List
* login(password, remember = true, validtime = 10)
* loginOAuth(openid, token)
* logout()
* refresh()
* calcList(appname)
* jobList()
* changeJobStatue (gid, statue)
* jobStatue (gid, callback)
* deleteJob(gid)
* jobInfo(gid)
* submitTask(dataOption)
* fileList(gid)
* download(gid, file) -> return file buffer
* upload(gid,file)
