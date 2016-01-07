var express = require('express');
var router = express.Router();
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
var logger = log4js.getLogger('u2be-gw');
var tObj = require('../api/famiApi');
/**
 * tcfg = {
      uName:streamConfig.uName,
      duid:streamConfig.duid,
      webhook:webhook,
      retry:retry,
      nickName : nName,
      url : 'https://www.youtube.com/watch?v='+vid +'&'+streamConfig.sid+'&'+streamConfig.status,
      isWarmup : isWarmup,
      ---------------------
      vid
      sid :
      status :
      isFerr :
      action :
      result : 'START','END
      auth
 * }
 */
router.post('/', function(req, res, next) {
  //console.log ('hook-process-status:' ,req.params, req.body, req.headers);
  var result = {code:200} //checkParams('POST',req);

  if(result.code == 200){
    //var cfg = result.msg;
    //console.log(req.params,req.body);
    console.log('-----> hook ---->'+req.params + '----->',req.body);
    if(req.body.result=='START'){
      tObj.transitApi(req.body);
    }
    logger.info(JSON.stringify(req.body));
    return res.status(200).send('Change ffmpeg status ok ');
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

  if(!req.params.userid){
    return {code: 404 , msg: 'User not found!'};
  }
  if(!req.params.duid){
    return {code: 404 , msg: 'Device not found!'};
  }

  console.log('success check params:',req.params,req.body);
  return {code:200}
}
module.exports = router;// JavaScript Document
