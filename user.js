const mongoose = require('mongoose');
const UserStoreSchema=new mongoose.Schema({
  name:{
    unique:true,
    type:String
  },
  keys:{
    access_token:String,
    session_key:String,
    timestamp:String,
    md5secret:String,
    err_code:Number,
    max_idle_time:Number
   
  },
  cookies:[String],
  _meta: {
    _createAt: {
      type: Date,
      default: Date.now()
    },
    _updateAt: {
      type: Date,
      default: Date.now()
    }
  }
}, { versionKey: false });


//数据每次更新都调用
UserStoreSchema.pre('save', function (next) {
  if (this.isNew) {
    this._meta._createAt = this._meta._updateAt = Date.now();
  }
  else {
    this._meta._updateAt = Date.now();
  } 
  next();
});

//静态方法
UserStoreSchema.statics = {
  fetch: function (cb) {
    return this
      .find({})
      //.sort({'_meta._updateAt': 'desc'})
      .exec(cb);
  },
  findById: function (_id, cb) {
    return this
      .findOne({_id: _id})
      .exec(cb);
  },
  findByName: function (name, cb) {
    return this
      .findOne({name})
      .exec(cb);
  },
  fetchTop: function (cb) {
    return this
      .find({})
      .limit(3)
      .sort({'_meta._updateAt': 'desc'})
      .exec(cb);
  },
};

module.exports = mongoose.model('UserStore',UserStoreSchema);
