var express = require('express');
var router = express.Router();

/* GET users listing. */
router.post('/:userid/:duid', function(req, res, next) {
  console.log ('hook-process-status:' ,req.params, req.body, req.headers);
  var result = checkParams('POST',req);
  if(result.code == 200){
    //var cfg = result.msg;
    //console.log(req.params,req.body);
    console.log('-----> hook ---->'+req.params + '----->',req.body)
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
