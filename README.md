# ScGrid SDK
## Usage
* load `const scgrid=require('scgrid')`;
* create mongoDB store: `await scgrid.createStore('mongodb://localhost:27017/db')`;
* create instance `const instance = new scgrid.ScGrid(username);`
* method available on instance, e.g. `await instance.login(password)`
* all methods return a Promise

**If mongoose is loaded and connected to mongoDB before this package is loaded, there is no need to call createStore to init store again**

**If not store with mongoDB, data will be stored in memory and will lost after program restart**

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
