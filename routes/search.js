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
router.get('/:userid/:channelid', function(req, res, next) {
    console.log ('get ... shared list' ,req.params, req.body, req.headers);
    var result = {code:200,msg:'SUCCESS'};
    if(!req.params.channelid){
        result.code = 404;
        result.msg = 'Channel not found';
    }
    logger.debug(JSON.stringify(
        { user:req.params.userid,
            channelid:req.params.channelid,
            action:'GET_SHARE_INFO',
            result:result.code==200?'SUCCESS':'FAIL',
            returnObj:liveCfg,
            headers : req.headers
        }));
    console.log('++++++',result);
    if(result.code == 200){
        var cfg = result.msg;
        //do serach status with cfg
        api.listVideoByChannel(req.params.channelid,'DOOR6',cfg,function(err,rtnMsg){
            console.log('in api callback------>');
            res.status(rtnMsg.code).send(rtnMsg);
        });
    } else {
        res.status(result.code).send(result);
    }
});
module.exports = router;// JavaScript Document