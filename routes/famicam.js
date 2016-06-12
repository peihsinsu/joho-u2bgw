var express = require('express');
var router = express.Router();
var api = require('../api/famiApi');
var log4js = require('log4js');
log4js.configure('./config/log.config', {});
if(!process.env.NODE_ENV){
  log4js.addAppender(
      require('fluent-logger').support.log4jsAppender(
          'u2bApi',
          { host: 'localhost', port: 24224, timeout: 3.0}
      )
  );
}

var logger = log4js.getLogger('u2beApi');
/* GET users listing. */
router.get('/:userid/:duid', function(req, res, next) {
  console.log ('get ... familive' ,req.params, req.body, req.headers);
  var result = checkParams('GET',req);
  logger.debug(JSON.stringify(
      { user:req.params.userid,
        duid:req.params.duid,
        action:'GET_LIVE_INFO',
        result:result.code==200?'SUCCESS':'FAIL',
        returnObj:liveCfg,
        headers : req.headers
      }));
  console.log('++++++',result);
  if(result.code == 200){
    var cfg = result.msg;
    //do serach status with cfg
    api.getLiveInfo(cfg,function(err,rtnMsg){
      console.log('in api callback------>');
      res.status(rtnMsg.code).send(rtnMsg);
    });
  } else {
    res.status(result.code).send(result);
  }
}).post('/:userid/:duid', function(req, res, next) {
  console.log ('post... familive' ,req.params, req.body, req.headers);
  var result = checkParams('POST',req);
  logger.debug(JSON.stringify(
      { user:req.params.userid,
        duid:req.params.duid,
        action:'POST_LIVE_EVENT',
        result:result.code==200?'SUCCESS':'FAIL',
        returnObj:result,
        headers : req.headers,
        body : req.body
      }));
  if(result.code == 200){
    var cfg = result.msg;
    //do live stream with cfg
    api.u2beLive(cfg,function(err,rtnMsg){
      console.log('live streaming result:',err,rtnMsg);
      try{
        if(err) return res.status(err).send(rtnMsg);
        else return res.status(200).send(rtnMsg);
      }catch(e){
        logger.error('***** Response Something wrong:'+cfg.userName + ' ******',e);
      }

    });
  }else return res.status(result.code).send(result);
});
/**
 *  liveCfg = {
 *    userToken :
 *    userName :
 *    duid :
 *    rstpSource :
 *  }
 **/
function checkParams(actionType,req){
  var shost = req.body.streamHost;
  var token = req.headers.authorization;
  if(!req.params.userid){
    return {code: 404 , msg: 'User not found!'};
  }
  if(!req.params.duid){
    return {code: 404 , msg: 'Device not found!'};
  }
  if(actionType=='POST' && !shost){
    return {code: 404 , msg: 'rtsp host not found!'};
  }

  if(!token){
    return {code: 403 , msg: 'Not authorized!'};
  }else if(token.indexOf('Bearer ')<0){
    return {code: 500 , msg: 'Token Bad format!'};
  }
  var tokenSet = token.split(' ');

  var liveCfg = {
    userName : req.params.userid,
    userToken : {
      access_token : tokenSet[1],
      token_type : tokenSet[0]
    } ,
    duid : req.params.duid,
    webhook : req.body.webHookHost || 'http://localhost:3000/liveHook',
    nickName : req.body.nickName || 'FAMI'
  };
  if(shost) liveCfg.rtspSource = ((shost.lastIndexOf('/') == shost.length-1)? shost.substr(0,shost.length-1) :shost)+ '/' + req.params.duid;
  if(req.body.status){
    liveCfg.status = req.body.status;
  }
  if(req.body.retry){
    liveCfg.retry = req.body.retry;
  }
  if(req.body.isWarmup && req.body.isWarmup == 'Y'){
    liveCfg.isWarmup = true;
  }else if(actionType=='POST'){
    liveCfg.isWarmup = false;
  }
  return {code:200 ,msg:liveCfg}
}
router.get('/share/:userid/:channelid', function(req, res, next) {
  console.log ('get ... shared list' ,req.params, req.body, req.headers);
  var result = {code:200,msg:'SUCCESS'};
  if(!req.params.channelid){
    result.code = 404;
    result.msg = 'Channel not found';
  }
  var token = req.headers.authorization;
  if(!token){
    return {code: 403 , msg: 'Not authorized!'};
  }else if(token.indexOf('Bearer ')<0){
    return {code: 500 , msg: 'Token Bad format!'};
  }
  var tokenSet = token.split(' ');
  var cfg = {
    userName : req.params.userid,
    userToken : {
      access_token : tokenSet[1],
      token_type : tokenSet[0]
    }
  };
  logger.debug(JSON.stringify(
      { user:req.params.userid,
        channelid:req.params.channelid,
        action:'GET_SHARE_INFO',
        result:result.code==200?'SUCCESS':'FAIL',
        returnObj:cfg,
        headers : req.headers
      }));
  console.log('++++++',result);
  if(result.code == 200){

    //do serach status with cfg
    api.listVideoByChannel(req.params.channelid,(porcess.env.DEBUG?'DOOR':req.params.userid),cfg,function(err,rtnMsg){
      console.log('in api callback------>');
      res.status(rtnMsg.code).send(rtnMsg);
    });
  } else {
    res.status(result.code).send(result);
  }
});
module.exports = router;// JavaScript Document
