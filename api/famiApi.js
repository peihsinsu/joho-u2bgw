/**
 * Created by sunnyhu on 15/11/1.
 * BROADCAST NAME = { famicam-$username-$yyyymmddhh24-live }
 */
var googleapis = require('googleapis');
var moment = require('moment');
//var ffmpeg = require('fluent-ffmpeg');
var flow = require('async');
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
var serviceAccount = require('../config/client_secret.json').installed;
var fcfg = require('../config/config.json');
var retryCfg = fcfg.retryCfg;

var request = require('request');
var extend = require('util')._extend;
var bStatus = {
  0 : 'created',
  1 : 'ready',
  2 : 'testing',
  3 : 'live',
  4 : 'complete',
  5 : 'testStarting',
  6 : 'liveStarting'
};
var sStatus = {
  0 : 'created',
  1 : 'ready',
  2 : 'active',
  3 : 'inactive'
};
var k8s = fcfg.k8s;
var logUrl = fcfg.logBack;

getAuth = function(secretStore,tokenStore,next){
  var auth = new googleapis.auth.OAuth2(
      secretStore.client_id,
      secretStore.client_secret,
      secretStore.redirect_uri);
  auth.setCredentials(tokenStore);
  logger.debug('step1 : Doing OAuth .');
  console.log('auth -----------------------');
  console.log('auth look like:',auth);
  console.log('auth -----------------------');
  if(next)
    next(null,auth);
  else
    return auth;
};
/**
 * -- transit tesing -->7lCYjXysbfY--> fail
 { [Error: Error during transition]
   code: 503,
   errors:
    [ { domain: 'youtube.liveBroadcast',
        reason: 'errorExecutingTransition',
        message: 'Error during transition' } ] }
 it was transit to test but 503 error ...
 * @param auth
 * @param youtube
 * @param status
 * @param videoId
 * @param next
 * @returns {*|Object}
 */
transitIt = function (auth,youtube, status, videoId, next) {
  var transitArgs = {
    broadcastStatus: status,
    id: videoId,
    part: 'id,status',
    auth: auth
  };
  return youtube.liveBroadcasts.transition(transitArgs, function (err, it) {
    delete transitArgs.auth;
    transitArgs.api = 'Broadcast Transition';
    if(it){
      transitArgs.msg = it.status
    }
    logger.debug('######## step list broadcast.########');
    doLog(err,transitArgs);
    return next(err, it);
  });
};

function doLog(err,logArgs){
  if(err){
    logArgs.err = err;
    logArgs.result = 'fail';
    logger.error(JSON.stringify(logArgs));
  }else{
    logArgs.result = 'success';
    logger.info(JSON.stringify(logArgs));
  }
}
/**
 * status = created -> ready -> testStarting -> testing -> liveStarting -> live -> complete
 * step 1. check boracast as it status
 *          transit status ,  current status
 *          testing        ,  ready
 *          live           ,  testing
 * step 2. if status is correct transit it
 *         else wait 5 second and check again
 * wait seconds can setup as config
 * retry = {
 *   count : 3,
 *   wait : 5
 * }
 **/
/*checkAndTransit = function( auth, youtube, status, videoId, retry, next){

}*/
/**
 * Because
 * @param auth
 * @param youtube
 * @param uName
 * @param duid
 * @param nName
 * @param next
 */
addBroadCast = function( auth, youtube, uName, duid, nName, next) {
  //** CHANGE GET DATE WITH CODE
  var sDate = new Date(new Date().getTime()+30*1000);
  var eDate = new Date(sDate.getFullYear()+1,sDate.getMonth(),sDate.getDate(),sDate.getHours(),sDate.getMinutes());
  console.log('nName------->',nName);
  var reqBroadcast = {
    part: 'snippet,status',
    resource: {
      snippet: {
        scheduledStartTime: moment(sDate).format('YYYY-MM-DDTHH:mm:ss.sZ'),
        scheduledEndTime: moment(eDate).format('YYYY-MM-DDTHH:mm:ss.sZ'),
        title: nName + '-' + uName + '-' + duid + '-' + moment(sDate).format('YYYYMMDDHHmm')
      },
      status: {
        privacyStatus: 'private'//'public'//
      }
    },
    auth:auth
  };
  var rCnt = 0;
  var logInfo = extend({},reqBroadcast);
  delete logInfo.auth;
  logInfo.api = 'Broadcast Insert';
  var rid = setInterval(
      function(){
        rCnt +=1;
        youtube.liveBroadcasts.insert(reqBroadcast, function (err, broadcast) {
          if(err && rCnt <=3){
            console.log('Insert Broadcast error, repeat:',rCnt);
            return;
          }
          clearInterval(rid);
          var bid = '';
          if(broadcast){
            bid = broadcast.id;
            reqBroadcast.msg = bid;
          }
          logger.debug('######## step insert broadcast.########');
          console.log('Video ID: ' + bid);
          doLog(err,logInfo);
          next(err,bid);
        });
      },1500
  );
};

//cost api 5 units quota
//Reuse stream than create new , check stream exists and status is inactive
addStream = function ( auth, youtube, uname, duid, next) {
  var assid;
  var ritem;
  listStream(auth,youtube,null,function(e,ss){
    for(var idx in ss.items){
      var sm = ss.items[idx];
      //console.log('Stream info:',stream);
      if(sm.snippet.title.indexOf(uname)>-1 && (sm.status.streamStatus==sStatus[1]||sm.status.streamStatus==[3])){
        console.log('find the same stream');
        assid = sm.id;
        ritem = sm;
        break;
      }
    }
    if(assid){
      var streamConfig = {
        sid : assid,
        sname : sm.cdn.ingestionInfo.streamName,
        surl : sm.cdn.ingestionInfo.ingestionAddress +'/'+ sm.cdn.ingestionInfo.streamName,
        status : 0 ,
        sStatus : sm.status.streamStatus,
        uName : uname ,
        duid : duid
      };
      doLog(e,streamConfig);
      next(null,streamConfig)
    }else{
      var reqStream = {
        part: 'snippet,cdn',
        resource: {
          snippet: {
            title: uname + '-' + duid
          },
          cdn: {
            format: '720p',
            ingestionType: 'rtmp'
          }
        },
        auth:auth
      };
      var rcnt = 0;
      var rid = setInterval(
        function() {
          // Need to do retry ....
          rcnt+=1;
          var logInfo = extend({},reqStream);
          delete logInfo.auth;
          youtube.liveStreams.insert(reqStream, function (err, stream) {
            //delete reqS.auth;
            if(err && rcnt<=3){
              console.log('Add stram error repeat:',rcnt);
              reqStream.api = 'Stream Insert err';
              //doLog(err,logInfo);
              return;
            }
            reqStream.api = 'Stream Insert';
            var streamName, streamAddress, streamId, streamUrl;
            if(stream){
              streamId = stream.id;
              streamName = stream.cdn.ingestionInfo.streamName;
              streamAddress = stream.cdn.ingestionInfo.ingestionAddress;
              streamUrl = streamAddress + '/' + streamName;
              logger.debug('######## step insert stream :['+streamId+'].########');
              console.log('Stream ID: ' + streamId + '/// url:' + streamUrl);
              var streamConfig = {
                sid : streamId,
                sname : streamName,
                surl : streamUrl,
                status : 0 ,
                sStatus : 'ready',
                uName : uname ,
                duid : duid
              };
              reqStream.msg = streamConfig;
            }
            doLog(err,logInfo);
            clearInterval(rid);
            next(err,streamConfig);
          });
        },1500);
    }
  });
};

//cost api 3 units quota
bindStream = function (auth,youtube,streamId,videoId ,cb) {
  var bindArgs = {
    part: 'id,contentDetails',
    id: videoId,
    streamId: streamId,
    auth: auth
  };
  youtube.liveBroadcasts.bind(bindArgs, function (err, bind) {
    logger.debug('######## step bind broadcast + stream .########');
    delete bindArgs.auth;
    bindArgs.api = 'Broadcast Bind';
    bindArgs.msg = bind;
    doLog(err,bindArgs);
    if(err && (err.code==500 || err.code=='500') && (err.message==null || err.message == 'null')){
      err = null;
      //it seem don't need query broadcast information again.
    }
    cb(err);
  });
};

/*
  cost api 3 units quota , add status -> broadcastStatus : all / completed / active / upcoming
  items[i]
  snippet.title
  status.lifeCycleStatus -> ready , testing , live , completed
  contentDetails.boundStreamId
                .monitorStream.embedHtml
 */
listBroadCast = function( auth, youtube, status, vid, next ){
  var listArg = {
    part: 'id,snippet,contentDetails,status',
    maxResults : 50 ,
    auth:auth
  };
  if(status) listArg.broadcastStatus = status ;
  else if(vid) listArg.id = vid ;
  else listArg.mine = true;
  youtube.liveBroadcasts.list( listArg, function(err, broadcasts){
    //console.log('list broads=====>',broadcasts);
    logger.debug('######## step list broadcast-status:'+status+'/vid:'+vid+' or mine .########');
    delete listArg.auth;
    listArg.api = 'Broadcast List';
    listArg.msg = '';//broadcasts;
    doLog(err,listArg);
    next(err,broadcasts);
  });
};

listStream = function(auth,youtube,streamId,next){
  var listArg = {
    part: 'id,snippet,cdn,status',
    maxResults : 50 ,
    auth:auth
  };
  if(streamId) listArg.id = streamId ;
  else listArg.mine = true;
  youtube.liveStreams.list(listArg,function(err, streams){
    logger.debug('######## step list stream :'+(streamId?streamId:'mine')+'  .########');
    delete listArg.auth;
    listArg.api = 'Stream List';
    listArg.msg = err?'List fail':'List success';
    doLog(err,listArg);
    next(err,streams);
  });
};

processStream = function (auth,youtube,rtspSrc,retry,webhook,vid,streamConfig,nName,isWarmup,next){
  streamConfig.vid = vid;
  var iid ='';
  var isFerr = false;
  var canTransit = false;
  logger.debug('processStream ...',isWarmup,retryCfg,sStatus[2],streamConfig.sStatus,streamConfig.sStatus != sStatus[2]);
  //判斷是否需ffmpeg
  if(streamConfig.sStatus != sStatus[2]){
    console.log('#### Process stream ffmpeg http://localhost:3001/processLiveV1 ####',streamConfig.uName);
    var ffmpegForm = {
      rtspSrc:rtspSrc,
      uName:streamConfig.uName,
      duid:streamConfig.duid,
      surl:streamConfig.surl,
      webhook:webhook,
      retry:retry,
      nickName : nName,
      url : 'https://www.youtube.com/watch?v='+vid +'&'+streamConfig.sid+'&'+streamConfig.status,
      isWarmup : isWarmup,
      logUrl : logUrl || 'http://localhost:3000/liveHook'
    };
    var options = {
      uri: k8s || 'http://localhost:3001/processLive',
      headers:{
        Authorization: auth.credentials.access_token
      },
      method: 'POST',
      json: ffmpegForm
    };
    request.post(
        /*'http://localhost:3001/processLive',
        {
          form:ffmpegForm
        }*/
        options,
        function(e,r,d) {
          console.log('ffmpeg response : ',e,d);
          streamConfig.api = 'ffmpeg post';
          var logInfo = {
            user:ffmpegForm.uName,
            duid:ffmpegForm.duid,
            action:'FFMPEG',
            URL :options.uri,
            result:(e?'FAIL':'SUCCESS'),
            body:ffmpegForm,
            returnObj:(e?e:{})};
          if (e) {
            streamConfig.msg = d;
            console.log('ffmpeg error :', e);
            //doLog(e, streamConfig);
            isFerr = true;
            logger.error(JSON.stringify(logInfo));
          } else {
            //doLog(null, streamConfig);
            canTransit = true;
            logger.info(JSON.stringify(logInfo));
            try {
              next(null, 'ffmpeg start:' + d.cmd);
            } catch (e) {
              next(null, 'ffmpeg start:' + d);
            }
          }
        });

  }else{
    next(null, 'ffmpeg has already start' );
    //doTransit
    canTransit = true;
    innerTransit();
  }
  if(process.env.TRANSIT){
    var wCnt = 0;
    flow.doUntil(
        function (callback) {
          wCnt++;
          setTimeout(function () {
            console.log('Wait transit',canTransit,wCnt);
            callback(null, canTransit);
          }, 1000);
        },
        function () { return canTransit||isFerr||wCnt>99; },
        function (err, n) {

          if(!err){
            if(isFerr){
              innerHook(1);
            }else
              innerTransit();
          }
        }

    );

  }

  function innerHook(rt){
    try{
      var hookURL = webhook+'/commJSON/NS/set_youtube_notification.php';//webhook+'/sunny/ABCD'
      console.log('#### process hook in FamiAPI:',hookURL,'isWarmup:',isWarmup);
      var hookForm = {
        userId:streamConfig.uName,
        duid:streamConfig.duid,
        result:rt,
        nickName:nName,
        retry:retry||0,
        url : 'https://www.youtube.com/watch?v='+vid,
        UTCTime : new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
      };
      var options = {
        uri: hookURL,
        method: 'POST',
        json: hookForm
      };
      return request(options,
          function(e,r,d){
            var logInfo = {
              user:hookForm.userId,
              duid:hookForm.duid,
              action:'WEBHOOK_TRANSIT',
              URL :hookURL,
              result:(e?'FAIL':'SUCCESS'),
              body:hookForm,
              returnObj:e}
            if(e) logger.error(JSON.stringify(logInfo));
            else logger.info(JSON.stringify(logInfo));
          });
    }catch(e){
      logger.error('Error hook error',e);
    }
  }
  //Transit depend on bdstatus ... and env TRANSIT_MODE == LOCALHOST
  //20151205 change it to docker run and callback do transit ...
  //if( process.env.TRANSIT_MODE == 'LOCALHOST'){
  function innerTransit(){
    //--
    var retryCnt = 0;
    var testStarting = '';
    console.log('------------->',streamConfig);
    if(streamConfig.status==2 && retryCnt == 0 && !isFerr){
      return innerHook(0);
    }
    //計時
    var iid = setInterval(function () {
      //重覆三次都錯
      if(streamConfig.status!=2 && retryCnt == retryCfg.cnt){
        clearInterval(iid);
        return innerHook(1);
      }
      if ((streamConfig.status == 0 || streamConfig.status == 1 )
          && retryCnt < retryCfg.cnt ) {
        listStream(auth, youtube, streamConfig.sid, function (err, stream) {
          retryCnt += 1;
          //see status ...
          for (var i = 0; i < stream.items.length; i++) {
            var item = stream.items[i];
            var sstatus = item.status.streamStatus;
            console.log('transit------->:',
                retryCnt, item.status, sstatus == sStatus[1], streamConfig.status);
            //READY , must add broadcast status = testing check
            if (sstatus == 'active') {
              if (streamConfig.status == 1 ) {
                //warm up do not transit it as live
                if(!isWarmup){
                  setTimeout(function () {
                    listBroadCast(auth, youtube, null, vid, function (err, bc) {
                      if (err) console.log('list broadcast error ...', err);
                      if (bc && bc.items[0].status.lifeCycleStatus == bStatus[2]) {
                        transitIt(auth, youtube, bStatus[3], vid, function (err, it) {
                          console.log(streamConfig.uName+'-'+streamConfig.duid,'-- transit live -->'+vid+'-->'+bc.items[0].status.lifeCycleStatus,err?'fail':'success');
                          if (err) {
                            console.log(err);
                          } else {
                            streamConfig.status == 2;
                            clearInterval(iid);
                            //do webhook
                            innerHook(0);
                          }
                        })
                      }
                    });
                  }, (testStarting?retryCfg.timeout:1000));
                } else {
                  clearInterval(iid);
                }
              } else if(streamConfig.status != 1 && !testStarting){
                transitIt(auth, youtube, bStatus[2], vid, function (err, it) {
                  console.log('-- transit tesing -->'+vid+'-->',err?'fail':'success');
                  if (err) {
                    console.log(err);
                    return;
                  }
                  streamConfig.status = 1;
                  testStarting = '1';
                  if(isWarmup){
                    clearInterval(iid);
                  }
                });
              }
            }
          }
        });
      } else clearInterval(iid);
    }, retryCfg.interval);
    //--
  }

};
/**
 * tcfg = {
      uName:streamConfig.uName,
      duid:streamConfig.duid,
      webhook:webhook,
      retry:retry,
      nickName : nName,
      url : 'https://www.youtube.com/watch?v='+vid +'&'+streamConfig.sid+'&'+streamConfig.status,
      isWarmup : isWarmup,
      vid
      sid :
      status :
      isFerr
 * }
 * ISSUE : OAuth can't pass , if ffmpeg process is dead and never post back to user.
 * @param tcfg
 */

exports.transitApi = function(tcfg){

  function innerHook(rt){
    try{
      var hookURL = tcfg.webhook+'/commJSON/NS/set_youtube_notification.php';//webhook+'/sunny/ABCD'
      console.log('#### process hook in FamiAPI:',hookURL,'isWarmup:',tcfg.isWarmup);
      var hookForm = {
        userId:tcfg.user,
        duid:tcfg.duid,
        result:rt,
        nickName:tcfg.nickName,
        retry:tcfg.retry||0,
        url : tcfg.url,
        UTCTime : new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
      };
      var options = {
        uri: hookURL,
        method: 'POST',
        json: hookForm
      };
      return request(options,
          function(e,r,d){
            var logInfo = {
              user:hookForm.userId,
              duid:hookForm.duid,
              action:'WEBHOOK_TRANSIT',
              URL :hookURL,
              result:(e?'FAIL':'SUCCESS'),
              body:hookForm,
              returnObj:e};
            if(e) logger.error(JSON.stringify(logInfo));
            else logger.info(JSON.stringify(logInfo));
          });
    }catch(e){
      logger.error('Error hook error',e);
    }
  }

  //Transit depend on bdstatus ...
  var retryCnt = 0;
  var testStarting = '';
  var token = { access_token:'',token_type:'Bearer'};
  var tauth = {};
  var tyoutube;
  try{
    token.access_token = tcfg.auth;//.split(' ')[1];
    tauth = getAuth(serviceAccount,token,null);
    tyoutube = googleapis.youtube('v3');;
  }catch(e){
    logger.error('get token error ...',e);
    return innerHook(1);
  }
  if(tcfg.status==2 && retryCnt == 0 && tcfg.isFerr!='true'){
    return innerHook(0);
  }
  //計時
  var iid = setInterval(function () {
    //重覆三次都錯
    if(tcfg.status!=2 && retryCnt == retryCfg.cnt){
      clearInterval(iid);
      return innerHook(1);
    }
    if ((tcfg.status == 0 || tcfg.status == 1 )
        && retryCnt < retryCfg.cnt ) {
      listStream(tauth, tyoutube, tcfg.sid, function (err, stream) {
        retryCnt += 1;
        //see status ...
        if(!stream||!stream.items){
          clearInterval(iid);
          return innerHook(1);
        }
        for (var i = 0; i < stream.items.length; i++) {
          var item = stream.items[i];
          var sstatus = item.status.streamStatus;
          console.log(tcfg.user+'--transit------->:',
              retryCnt, item.status, tcfg.status);
          //READY , must add broadcast status = testing check
          if (sstatus == 'active') {
            if (tcfg.status == 1 ) {
              //warm up do not transit it as live
              if(tcfg.isWarmup=='false'){
                setTimeout(function () {

                  listBroadCast(tauth, tyoutube, null, tcfg.vid, function (err, bc) {
                    if (err) console.log('list broadcast error ...', err);
                    if (bc && bc.items[0].status.lifeCycleStatus == bStatus[2]) {
                      transitIt(tauth, tyoutube, bStatus[3], tcfg.vid, function (err, it) {
                        console.log(tcfg.user+'-'+tcfg.duid,'-- transit live -->'+tcfg.vid+'-->'+bc.items[0].status.lifeCycleStatus,err?'fail':'success');
                        if (err) {
                          console.log(err);
                        } else {
                          tcfg.status == 2;
                          clearInterval(iid);
                          //do webhook
                          return innerHook(0);
                        }
                      })
                    }
                  });
                }, (testStarting?retryCfg.timeout:1000));
              } else {
                clearInterval(iid);
              }
            } else if(tcfg.status != 1 && !testStarting){
              transitIt(tauth, tyoutube, bStatus[2], tcfg.vid, function (err, it) {
                console.log('-- transit tesing -->'+tcfg.vid+'-->',err?'fail':'success');
                if (err) {
                  console.log(err);
                  return;
                }
                tcfg.status = 1;
                testStarting = '1';
                if(tcfg.isWarmup=='true'){
                  clearInterval(iid);
                }
              });
            }
          }
        }
      });
    } else clearInterval(iid);
  }, retryCfg.interval);
}

//api flow
function getBroadCast(liveCfg, youtube ,next){
  function inner(status,cb){
    listBroadCast(liveCfg.auth,youtube,status,null,function(err,bcs){
      var checkR;
      if(bcs) checkR = checkBCExist(bcs.items, liveCfg.userName,liveCfg.duid);
      cb(err,checkR);
    });
  }
  //Check steram
  flow.auto({
    listU : function(cb,results){
      inner('upcoming',cb);
    },
    listA : function(cb,results){
      if(results.listU){
        return cb(null,null);
      }else{
        inner('active',cb);
      }
    }
  },function(err,results){
    var rtnItem = {};
    if(results.listU) rtnItem = results.listU;
    if(results.listA) rtnItem = results.listA;
    console.log('list broacast auto:',rtnItem);
    next(err,rtnItem);
  });
}
//crate broadcast flow
/*function insBCFlow(liveCfg, bc, youtube, next){
  flow.waterfall([
      //create B
      function(cb){
      },
      //create S , getStream , if not exists than create
      function(n,cb){
      },
      //do reuseBCFlow
      function(n,cb){
      }
    ]
    ,function(err,results){

    }
  );
}*/

//reust broadcast flow
/*function reuseBCFlow(liveCfg, bc,csId, youtube, next){
  flow.auto(
  {
    listS : function(cb,results){
      listStream(liveCfg.auth,youtube,
        bc.contentDetails.boundStreamId?bc.contentDetails.boundStreamId:csId,
          function(err,streams){

        var streamCfg = checkStreamStatus(streams.items, liveCfg);
        //not active should send ffmpeg
        if(!streamCfg.sstatus==sStatus[2]){
          processStream(liveCfg.auth,youtube,liveCfg.rtspSource,bc.id,streamCfg);
        }
        cb(err, ( err?'':streamCfg ) );

      })
    },
    //bc.contentDetails.boundStreamId is null than bindBS
    bindBS : function(cb,results){

    },
    transitT : function(cb,results){
      doTransit(bc,liveCfg,cb,bStatus[2]);
    },
    transitS : function(cb,results){
      doTransit(bc,liveCfg,cb,bStatus[3]);
    }
  },
  function(err,results){
    doLog(err,results);
    next(err,results);
  });
}*/
/*
function doTransit(bc,liveCfg,cb,tStatus){
  var rcnt = 0;
  //is live than return
  if(bc.status.lifeCycleStatus == bStatus[3]) {
    rcnt +=3;
    cb(null,bc.status.lifeCycleStatus);
  }else if( ( bc.status.lifeCycleStatus == bStatus[1] && tStatus == bStatus[2] )
    || ( bc.status.lifeCycleStatus == bStatus[2] && tStatus == bStatus[3]) ){
    var iid = setInterval(function(){
      if(rcnt >= 3 || streamCfg.status>1){
        clearInterval(iid);
        return cb('retry transit live 3 times all fail..');
      }
      transitIt(liveCfg.auth,youtube, tStatus, bc.id, function(err,it){
        if(err){
          console.log('transit '+tStatus+' err:',err);
        }else{
          streamCfg.status = tStatus==bStatus[2]?1:2;
          rcnt = 3;
          clearInterval(iid);
          return cb(null,it);
        }
      });
      rcnt +=1;
    },5000);
  }
}

function checkStreamStatus(streams, liveCfg, compare){
  for(var idx =0; idx < streams.length ; idx++){
    var stream = streams[idx];
    if(stream.snippet.title == liveCfg.userName + '-' + liveCfg.duid){
      var streamConfig = {
        sid : stream.id,
        sname : stream.cdn.ingestionInfo.streamName,
        surl : stream.cdn.ingestionInfo.ingestionAddress + '/' + sname,
        status : 0 ,
        sstatus : status.streamStatus
      }
      console.log('Stream info :',streamConfig);
      if(!compare)
        return streamConfig;
    }
  }
}
*/
/**
 *  liveCfg = {
 *    userToken :
 *    userName :
 *    duid :
 *    rtspSource :
 *  }
 *  Test1 : test only access token can do the right thing ..  ok
 *  Test2 : User not approve api , still can use ? ok
 **/
exports.u2beLiveFlow = function(liveCfg,next){
  var youtube = googleapis.youtube('v3');
  getAuth(servicAccount,liveCfg.userToken,function(err,auth){
    liveCfg.auth = auth;
    if(err || !auth) {
      doLog('auth error!', liveCfg);
      return next({msg: 'auth error!', cfg: liveCfg});
    }else{
      getBroadCast(liveCfg, youtube ,function(err,bc){
        //have broadcast
        if(bc){

        //add broadcast
        }else{
        }
      });
    }
  });

};

function checkBCExist( items, uname, duid ){
  var prefix =  uname + '-' + duid;
  //console.log('checkBCExist =====>',items);
  var item ;
  for(var idx =0;idx< items.length;idx++){
    item = items[idx];
    //console.log("+++++",item.snippet.title,item);
    if(item.snippet.title.indexOf(prefix)>=0){
      //console.log('--->getitem =',item);
      return item;
    }
  }
}

/**
 * PROVIDE FRONTEND SEARCH STREAM STATUS
 */
exports.getLiveInfo = function(liveCfg,next) {
  var youtube = googleapis.youtube('v3');
  getAuth(serviceAccount, liveCfg.userToken, function (err, auth) {
    liveCfg.auth = auth;
    getBroadCast(liveCfg, youtube, function (err, bCast) {
      if(err) return next(err,{code:500,msg:'Query live event error!!'+err.message});
      var rtnList = [];
      if (bCast && bCast.snippet) {
        //console.log('------->',results.length);
        //for (var i = 0; i < results.length; i++) {

          if (bCast.snippet.title.indexOf(liveCfg.userName + '-' + liveCfg.duid) > -1) {
            //(function(i){
              listStream(liveCfg.auth,youtube,bCast.contentDetails.boundStreamId,function(err,streams){
                if(err) next(err,{code: 500, msg: 'List live events err - '+err.message});
                var rtnItem = {
                  duid: liveCfg.duid,
                  eventId: bCast.id,
                  eventName: bCast.snippet.title,
                  eventStatus: bCast.status.lifeCycleStatus,
                  streamStatus: streams||streams.items?streams.items[0].status.streamStatus:'',
                  url: 'https://www.youtube.com/watch?' + bCast.id
                }
                rtnList.push(rtnItem);
                //if(i=results.length -1 ){
                if(rtnList.length >0 )  next(null,{code: 200, msg:'success' ,stream: rtnList});
                else next(404,{code: 404, msg: 'Can not found live events'});
                //}
              });
            //})(i);
          }
        //}
      } else {
        next(404,{code: 404, msg: 'Can not found live events'});
      }
    });
  });
};


var doLiveStream = function(auth,youtube,cfg,next){
  var uName = cfg.userName;
  var duid = cfg.duid;
  var rtspUrl = cfg.rtspSource;
  var webhook = cfg.webhook;
  var retry = cfg.retry;
  addBroadCast(auth,youtube,uName,duid,cfg.nickName,function(err,videoId){
    console.log('add broad cast end');
    if(err) return next(501,{code:501,msg:'Add event -'+err.message});
    addStream(auth,youtube,uName,duid,function(err,streamConfig){
      if(err) return next(501,{code:501,msg:'Add stream -'+err.message});
      bindStream(auth,youtube,streamConfig.sid,videoId,function(err){
        if(err) return next(501,{code:501,msg:'Bind stream -'+err.message});
        processStream(auth,
            youtube,
            rtspUrl,
            retry,
            webhook,
            videoId,
            streamConfig,
            cfg.nickName,
            cfg.isWarmup,
            function(err,result){
              //do webhook ...
              if( cfg.isWarmup && !err ){
                next(null,{
                  code : 200,
                  msg : 'Success',
                  eventId : videoId,
                  url : 'https://www.youtube.com/watch?v='+videoId,
                  eventStatus : 'ready',
                  isWarmup : 'Y'
                });
              }else if( cfg.isWarmup && err ){
                next(null,{
                  code : 500,
                  msg : 'fail:'+err,
                  eventId : videoId,
                  url : 'https://www.youtube.com/watch?v='+videoId,
                  eventStatus : 'ready',
                  isWarmup : 'Y'
                });
              }
        });
        if(!cfg.isWarmup){
          next(null,{
            code : 200,
            msg : 'Success',
            eventId : videoId,
            url : 'https://www.youtube.com/watch?v='+videoId,
            eventStatus : 'ready',
            isWarmup : 'N'
          });
        }
      });
    });
  });
};

//must consider if rtsp server is down
//var streamSrc = 'rtsp://104.155.214.170/GACWPNS291O6U46L0SC4'
//u2beLive = function(servicAccount,uToken,uName,duid,streamSrc,next)
//LIVE STREAM SCENARIO
exports.u2beLive = function(liveCfg,next){
  var youtube = googleapis.youtube('v3');
  var uToken = liveCfg.userToken;
  var uName = liveCfg.userName;
  var streamSrc = liveCfg.rtspSource;
  var duid = liveCfg.duid;
  var nName = liveCfg.nickName;
  getAuth(serviceAccount,uToken,function(err,auth){

    if(err){
      return next(403,{code:403,msg:err.message});
    }
    //var liveFlag = true;
    liveCfg.auth = auth;
    getBroadCast(liveCfg, youtube, function (err, cfg) {
      console.log('Error ..:',err );
      if (err) {
        //console.log(err);
        return next(err.code||501,{code:err.code||501,msg:'List event -'+err.message});
      }
      var vid = '';
      var sid = '';
      var bdstatus = '';

      if(!( cfg && cfg.id )){
        console.log('do live :',streamSrc );
        doLiveStream(auth,youtube,liveCfg,next);
      } else {
        vid = cfg.id,sid = cfg.contentDetails.boundStreamId,bdstatus = cfg.status.lifeCycleStatus;
        listStream(auth,youtube,sid,function(err,streams){
          var stream = streams.items[0];
          var streamName, streamAddress;
          if (err) {
            console.log(err);
            return next(501,{code:501,msg:'List stream -'+err.message});
          }
          var streamId = stream.id;
          streamName = stream.cdn.ingestionInfo.streamName;
          streamAddress = stream.cdn.ingestionInfo.ingestionAddress;
          var streamUrl = streamAddress + '/' + streamName;
          console.log('Stream ID: ' + streamId + '/// url:' + streamUrl);
          var streamConfig = {
            sid : streamId,
            sname : streamName,
            surl : streamUrl,
            status : (bdstatus && bdstatus==bStatus[3])?2:(bdstatus && bdstatus==bStatus[2])?1:0,
            sStatus : stream.status.streamStatus,
            uName : uName ,
            duid : duid
          };
          //check live stream than alert network error.
          processStream(auth,youtube,liveCfg.rtspSource,liveCfg.retry,
              liveCfg.webhook,vid,streamConfig,liveCfg.nickName,liveCfg.isWarmup,
              function(err,result){
                //do webhook ...
                if( liveCfg.isWarmup && !err ){
                  next(null,{
                    code : 200,
                    msg : 'Success',
                    eventId : vid,
                    url : 'https://www.youtube.com/watch?v='+vid,
                    eventStatus : bdstatus,
                    isWarmup : 'Y'
                  });
                }else if( liveCfg.isWarmup && err ){
                  next(null,{
                    code : 500,
                    msg : 'fail:'+err,
                    eventId : vid,
                    url : 'https://www.youtube.com/watch?v='+vid,
                    eventStatus : bdstatus,
                    isWarmup : 'Y'
                  });
                }
          });
          if(!liveCfg.isWarmup){
            next(null,{
              code : 200,
              msg : 'Success',
              eventId : vid,
              url : 'https://www.youtube.com/watch?v='+vid,
              eventStatus : bdstatus,
              isWarmup : 'N'
            });
          }
        });
      }
    });
  });
};
/**
 * cid : Channel ID
 * fStr : filter string
 *
 */
exports.listVideoByChannel = function(cid,fStr,liveCfg,next){
  flow.waterfall([
    flow.apply(getAuth, serviceAccount, liveCfg.userToken),
    function(auth, callback) {
      liveCfg.auth = auth;
      var youtube = googleapis.youtube('v3');
      getSharedVideo(liveCfg,youtube,cid,fStr,callback);
    }
  ], function (err, result) {
    if(err){
      next(null,{
        code : 500,
        msg : 'fail:'+err,
        channelId : cid,
        key: fStr,
        items: null
      });
    }else{
      next(null,{
        code : (result && result.length>0) ? 200 : 404,
        msg : (result && result.length>0) ?'SUCCESS' : 'NOT FOUND',
        channelId : cid,
        key: fStr,
        items: result
      });
    }
  });

};
//未處理換頁問題
/**
 * 僅取得前50筆
 * @param liveCfg
 * @param youtube
 * @param cid
 * @param fStr
 * @param next
 */
function getSharedVideo(liveCfg, youtube, cid, fStr ,next){
  function inner(status,cb){
    listByChannel(liveCfg.auth, youtube, cid, status, function(err,s){
      var checkR;
      if(s) checkR = filterByKey( s.items, fStr, liveCfg.userName );
      cb(err,checkR);
    });
  }
  //Check steram
  flow.auto({
    listA : function(cb){
      inner('live',cb);
    },
    listC : function(cb,results){
      if(results.listU){
        return cb(null,null);
      }else{
        inner('completed',cb);
      }
    }
  },function(err,results){
    logger.debug('xxxxx:',results.listC);
    var rtnItem = [];
    if(results.listA) rtnItem.push(results.listA);
    if(results.listC) rtnItem.push(results.listC);
    //console.log('list shared auto:',rtnItem);
    next(err,rtnItem);
  });
}

function listByChannel( auth, youtube, cid, status, next ){

  var listArg = {
    part: 'snippet',
    channelId : cid,
    type : 'video',
    maxResults : 50 ,
    auth:auth
  };
  if(status) listArg.eventType = status;

  youtube.search.list( listArg, function(err, results){
    //console.log('list broads=====>',broadcasts);
    logger.debug('######## search list:',results);
    delete listArg.auth;
    listArg.api = 'Search List';
    listArg.msg = '';//broadcasts;
    doLog(err,listArg);
    next(err,results);
  });
}
/**filter by key and generate json
 * {
 *   userid : ,
 *   channelId : item.snippet.channelId
 *   channelTitle : item.snippet.channelTitle
 *   videoId : item.id.videoId,
 *   publishTime : item.snippet.publishedAt,
 *   title : item.snippet.title ,
 *   thumbnails : {
 *             "url": "https://i.ytimg.com/vi/MSNzJ9lY9nA/default.jpg",
 *             "width": 120,
 *             "height": 90
 *           } // item.snippet.thumbnails.default
 *
 * }
 * @param items
 * @param key
 * @returns {*}
 */
function filterByKey( items, key , userId ){
  var prefix =  key;
  //console.log('checkBCExist =====>',items);
  var item ;

  var rs = [];
  for(var idx =0;idx< items.length;idx++){
    item = items[idx];
    //console.log("+++++",item.snippet.title,item);
    //console.log(item.snippet.title.indexOf(prefix),item.snippet.title,key);
    if(item.snippet.title.indexOf(prefix)>=0){
      //console.log('--->getitem =',item);
      rs.push({
        userId : userId,
        channelId : item.snippet.channelId,
        channelTitle : item.snippet.channelTitle,
        videoId : item.id.videoId,
        publishTime : item.snippet.publishedAt,
        title : item.snippet.title ,
        thumbnails : item.snippet.thumbnails.default
      });
    }
  }
  //console.log('xxxxx',rs);
  if(rs.length>0) return rs;
  else return null;
}
