var express = require('express');
var router = express.Router();
var api = require('../api/famiApi');

/* GET users listing. */
router.get('/:userid/:duid', function(req, res, next) {
  console.log ('get ... familive' ,req.params, req.body, req.headers);
  var result = checkParams('GET',req);
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
  if(result.code == 200){
    var cfg = result.msg;
    //do live stream with cfg
    api.u2beLive(cfg,function(err,rtnMsg){
      console.log('live streaming result:',err,rtnMsg);
      if(err) return res.status(err).send(rtnMsg);
      else return res.status(200).send(rtnMsg);
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
  }
  if(shost) liveCfg.rtspSource = ((shost.lastIndexOf('/') == shost.length-1)? shost.substr(0,shost.length-1) :shost)+ '/' + req.params.duid;
  if(req.body.status){
    liveCfg.status = req.body.status;
  }
  if(req.body.retry){
    liveCfg.retry = req.body.retry;
  }

  console.log('success check params:',liveCfg);
  return {code:200 ,msg:liveCfg}
}
module.exports = router;// JavaScript Document
