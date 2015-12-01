/**
 * Created by sunnyhu on 15/11/1.
 * BROADCAST NAME = { famicam-$username-$yyyymmddhh24-live }
 */
var googleapis = require('googleapis');
var moment = require('moment');
//var readline = require('readline');
var ffmpeg = require('fluent-ffmpeg');
var flow = require('async');
var log4js = require('log4js');
log4js.configure('log.config', {});
var logger = log4js.getLogger('u2be-gw');
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
}
var sunnyToken = {
  access_token: 'ya29.FwJb7fnGJiPtO1m3ny7_2yAvPRmn97gthV9gnskBrsfKrmoaLO95nMjQnR4SVaehYocr',
  token_type: 'Bearer',
  refresh_token: '1/emzknGU5W_ZmE0Yzwo0DMLKve6cSrQ0sc92yzNRf7qU',
  expiry_date: 1445793271091
};

//'161639684388-6c8utml7h4f05qv02m90721butpktt4l.apps.googleusercontent.com';
//'KLzPuIuqbe1za7ueQMr_c1hj';
var serviceAccount = {
  client_id:'516742858450-a33kmlfflsjo1kqj9khcpjfefak272hn.apps.googleusercontent.com',
  client_secret:'RvqFbHgXvEwG4prcDVccaB-B',
  redirect_uri :'urn:ietf:wg:oauth:2.0:oob'
}

getAccessToken = function (auth, next) {
  var url;
  url = auth.generateAuthUrl({
    access_type: 'offline',
    scope: 'https://www.googleapis.com/auth/youtube'
  });
  console.log('Vist the url: ' + url);
  return rl.question('Enter the Code:', function (code) {
    return auth.getToken(code, function (err, tokens) {
      console.log(tokens);
      auth.setCredentials(tokens);
      return next();
    });
  });
};

getAuth = function(secretStore,tokenStore,next){
  //change it to get with json file
  var auth = new googleapis.auth.OAuth2(
      secretStore.client_id,
      secretStore.client_secret,
      secretStore.redirect_uri);
  var youtube = googleapis.youtube('v3');
  /* first time get token using - getAccessToken
   console.log('auth back :',getAccessToken(auth,function(){
   console.log('after get token next ...');
   }));*/
  auth.setCredentials(tokenStore);
  console.log('auth look like:',auth);
  console.log('auth -----------------------');
  next(null,auth);
}

//cost api 5 units quota
transitIt = function (auth,youtube, status, videoId, next) {
  var transitArgs = {
    broadcastStatus: status,
    id: videoId,
    part: 'id,status',
    auth: auth
  }
  return youtube.liveBroadcasts.transition(transitArgs, function (err, it) {
    delete transitArgs.auth;
    transitArgs.api = 'Broadcast Transition';
    if(it){
      transitArgs.msg = it.status
    }
    doLog(err,transitArgs)
    return next(err, it);
  });
};

function doLog(err,logArgs){
  if(err){
    logArgs.err = err;
    logArgs.result = 'fail'
    logger.error(JSON.stringify(logArgs));
  }else{
    logArgs.result = 'success'
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
checkAndTransit = function( auth, youtube, status, videoId, retry, next){

}

//cost api 5 units quota
addBroadCast = function( auth, youtube, uname, duid, next) {
  //** CHANGE GET DATE WITH CODE
  var sDate = new Date(new Date().getTime()+30*1000);
  var eDate = new Date(sDate.getFullYear()+1,sDate.getMonth(),sDate.getDate(),sDate.getHours(),sDate.getMinutes());
  var reqBroadcast = {
    part: 'snippet,status',
    resource: {
      snippet: {
        scheduledStartTime: moment(sDate).format('YYYY-MM-DDTHH:mm:ss.sZ'),
        scheduledEndTime: moment(eDate).format('YYYY-MM-DDTHH:mm:ss.sZ'),
        title: uname + '-' + duid + '-' + moment(sDate).format('YYYYMMDDHHmm')
      },
      status: {
        privacyStatus: 'private'
      }
    },
    auth:auth
  };
  youtube.liveBroadcasts.insert(reqBroadcast, function (err, broadcast) {
    delete reqBroadcast.auth;
    reqBroadcast.api = 'Broadcast Insert';
    var bid = '';
    if(broadcast){
      bid = broadcast.id;
      reqBroadcast.msg = bid;
    }
    doLog(err,reqBroadcast);
    console.log('Video ID: ' + bid);
    next(err,bid);
  });
};

//cost api 5 units quota
addStream = function ( auth, youtube, uname, duid, next) {
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
  youtube.liveStreams.insert(reqStream, function (err, stream) {
    delete reqStream.auth;
    reqStream.api = 'Stream Insert';
    var streamName, streamAddress;
    if(stream){
      streamId = stream.id;
      streamName = stream.cdn.ingestionInfo.streamName;
      streamAddress = stream.cdn.ingestionInfo.ingestionAddress;
      streamUrl = streamAddress + '/' + streamName;
      console.log('Stream ID: ' + streamId + '/// url:' + streamUrl);
      var streamConfig = {
        sid : streamId,
        sname : streamName,
        surl : streamUrl,
        status : 0 ,
        uname : uname ,
        duid : duid
      }
      reqStream.msg = streamConfig;
    }
    doLog(err,reqStream);
    next(err,streamConfig);
  });
};

//cost api 3 units quota
bindStream = function (auth,youtube,streamId,videoId ,next) {
  var bindArgs = {
    part: 'id,contentDetails',
    id: videoId,
    streamId: streamId,
    auth: auth
  };
  youtube.liveBroadcasts.bind(bindArgs, function (err, bind) {
    console.log('bind ===>', bind);
    delete bindArgs.auth;
    bindArgs.api = 'Broadcast Bind';
    bindArgs.msg = bind;
    doLog(err,bindArgs);
    next(err,bind);
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
  }
  if(status) listArg.broadcastStatus = status ;
  else if(vid) listArg.id = vid ;
  else listArg.mine = true;
  console.log('List args :',listArg);
  youtube.liveBroadcasts.list( listArg, function(err, broadcasts){
    console.log('list broads=====>',broadcasts);
    delete listArg.auth;
    listArg.api = 'Broadcast List';
    listArg.msg = broadcasts;
    doLog(err,listArg);
    next(err,broadcasts);
  });
};

listStream = function(auth,youtube,streamId,next){
  var listArg = {
    part: 'id,snippet,cdn,status',
    //id : streamId,
    //mine: true,
    maxResults : 50 ,
    auth:auth
  }
  if(streamId) listArg.id = streamId ;
  else listArg.mine = true;
  console.log('List args :',listArg);
  youtube.liveStreams.list(listArg,function(err, streams){
    console.log('list stream=====>',streams);
    delete listArg.auth;
    listArg.api = 'Stream List';
    listArg.msg = streams;
    doLog(err,listArg);
    next(err,streams);
  });
};

processStream = function (auth,youtube,rtspSrc,vid,streamConfig,next){
  var commandstr = '';
  streamConfig.vid = vid;
  var iid ='';
  var fmpg = new ffmpeg({
    source: rtspSrc // 'rtsp://104.155.214.170/GACWPNS291O6U46L0SC4'//'test.flv'//
  })
    //.addInputOption('-re')
      .addInputOption('-rtsp_transport tcp')
    //.withVideoCodec('libx264')
      .withVideoCodec('copy')
      .withAudioBitrate('128k')
      .withAudioChannels(2)
      .withAudioFrequency(44100)
    //.withSize('1280x720')
      .withFps(30).toFormat('flv')
    //.addOptions(['-g 1', '-force_key_frames 2'])
      .on('start', function(command){
        commandstr = command;
        streamConfig.commandLine = command;
        streamConfig.msg = 'ffmpeg start ' ;
        doLog(null,streamConfig);
        next(null,'ffmpeg start:'+command);
        var retryCnt = 0;
        //if( streamConfig.status == 0 && retryCnt < 3 ){
        iid = setInterval(function(){
          if( (streamConfig.status == 0 || streamConfig.status == 1) && retryCnt < 3 ){
            listStream(auth,youtube,streamConfig.sid,function(err,stream){
              retryCnt +=1;
              //see status ...
              for(var i=0;i<stream.items.length;i++){
                var item = stream.items[i];
                var sstatus =item.status.streamStatus;
                console.log('transit------->:',
                    retryCnt,item.status,sstatus==sStatus[1],streamConfig.status);
                //READY , must add broadcast status = testing check
                if(sstatus=='active'){
                  if(streamConfig.status==1){
                    //setTimeout(function(){
                    transitIt(auth,youtube,bStatus[3],vid,function(err,it){
                      console.log('-- transit live -->');
                      if(err){
                        console.log(err);
                      }else{
                        streamConfig.status = 2;
                        clearInterval(iid);
                      }
                    })//},10000);
                  }else {
                    transitIt(auth,youtube,bStatus[2],vid,function(err,it){
                      console.log('-- transit tesing -->');
                      if(err){
                        console.log(err);
                        return;
                      }
                      streamConfig.status = 1;
                      setTimeout(function(){
                        listBroadCast(auth,youtube,null,vid,function(err,bc){
                          if(err) console.log('list broadcast error ...',err);
                          if(bc && bc.items[0].status.lifeCycleStatus == bStatus[2]){
                            transitIt(auth,youtube,bStatus[3],vid,function(err,it){
                              console.log('-- transit live -->');
                              if(err){
                                console.log(err);
                              }else{
                                streamConfig.status == 2;
                                clearInterval(iid);
                              }
                            })
                          }
                        });
                      },10000);
                      //}
                    });
                  }
                }
              }
            });
          } else clearInterval(iid);
        },15000);
        //}
        return console.log('FFmpeg start with ' , command);
      })
    /*.on('progress', function(){
     //console.log('progress video...');
     //ADD SLOW DOWN ...

     })*/
      .on('end', function(){
        //hook to frontend
        streamConfig.msg = 'ffmpeg end';
        doLog(null,streamConfig);
        next();

      })
      .on('error', function(err, stdout, stderr) {
        console.log('Cannot process video: ' + err.message);
        try{
          clearInterval(iid);
        }catch(err){
          console.log(error);
        }
        //hook to frontend
        streamConfig.msg = 'ffmpeg error:' + err.message;
        doLog(err,streamConfig);
        next(err);
      })
      .save(streamConfig.surl);
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
      /*listBroadCast(liveCfg.auth,youtube,'upcoming',null,function(err,bcs){
       checkR = checkExist(bcs, liveCfg.userName,liveCfg.duid);
       cb(err,checkR);
       });*/
    },
    listA : function(cb,results){
      if(results.listU){
        return cb(null,null);
      }else{
        inner('active',cb);
        /*listBroadCast(liveCfg.auth,youtube,'active',null,function(err,bcs){
         checkR = checkExist(bcs, liveCfg.userName,liveCfg.duid);
         cb(err,checkR);
         });*/
      }
    }
  },function(err,results){
    //console.log('---------------- :',results);
    rtnItem = {};
    if(results.listU) rtnItem = results.listU;
    if(results.listA) rtnItem = results.listA;
    console.log('list broacast auto:',rtnItem);
    next(err,rtnItem);
  });
}
//crate broadcast flow
function insBCFlow(liveCfg, bc, youtube, next){
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
}

//reust broadcast flow
function reuseBCFlow(liveCfg, bc,csId, youtube, next){
  flow.auto(
      {
        listS : function(cb,results){
          listStream(liveCfg.auth,youtube,
              bc.contentDetails.boundStreamId?bc.contentDetails.boundStreamId:csId,
              function(err,streams){

                streamCfg = checkStreamStatus(streams.items, liveCfg);
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
}

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
    stream = streams[idx];
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

}

function checkBCExist( items, uname, duid){
  var prefix = uname + '-' + duid;
  //console.log('checkBCExist =====>',items);
  var item ;
  for(var idx =0;idx< items.length;idx++){
    item = items[idx];
    //console.log("+++++",item.snippet.title,item);
    if(item.snippet.title.indexOf(prefix)>=0){
      console.log('--->getitem =',item);
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
      rtnList = [];
      if (bCast && bCast.snippet) {
        //console.log('------->',results.length);
        //for (var i = 0; i < results.length; i++) {

        if (bCast.snippet.title.indexOf(liveCfg.userName + '-' + liveCfg.duid) > -1) {
          //(function(i){
          listStream(liveCfg.auth,youtube,bCast.contentDetails.boundStreamId,function(err,streams){
            if(err) next(err,{code: 500, msg: 'List live events err - '+err.message});
            rtnItem = {
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
}


var doLiveStream = function(auth,youtube,rtspUrl,uName,duid,next){
  addBroadCast(auth,youtube,uName,duid,function(err,videoId){
    console.log('add broad cast end');
    if(err) return next(501,{code:501,msg:'Add event -'+err.message});
    addStream(auth,youtube,uName,duid,function(err,streamConfig){
      if(err) return next(501,{code:501,msg:'Add stream -'+err.message});
      bindStream(auth,youtube,streamConfig.sid,videoId,function(err){
        if(err) return next(501,{code:501,msg:'Bind stream -'+err.message});
        processStream(auth,youtube,rtspUrl,videoId,streamConfig,function(err,result){
          //do webhook ...

        });
        next(null,{
          code : 200,
          msg : 'Success',
          eventId : vid,
          url : 'https://www.youtube.com/watch?v='+videoId,
          eventStatus : 'ready'
        });

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
  uToken = liveCfg.userToken;
  uName = liveCfg.userName;
  streamSrc = liveCfg.rtspSource;
  duid = liveCfg.duid;

  getAuth(serviceAccount,uToken,function(err,auth){
    //listStream(auth,youtube,'0COI9XLKagO6Hs0V3fhdog1446305048563691',function(err,cfg){
    if(err){
      return next(403,{code:403,msg:err.message});
    }
    var liveFlag = true;
    liveCfg.auth = auth;
    getBroadCast(liveCfg, youtube, function (err, cfg) {
      //listBroadCast(auth,youtube,'upcoming',null,function(err,cfg){
      console.log('Error ..:',err , cfg);
      if (err) {
        //console.log(err);
        return next(err.code||501,{code:err.code||501,msg:'List event -'+err.message});
      }
      vid = '';
      sid = '';
      bdstatus = '';
      /*for(var i=0;i<cfg.items.length;i++){
       //console.log(cfg.items[i].status);
       console.log('title:',cfg.items[i].snippet.title);
       console.log('status:',cfg.items[i].status.lifeCycleStatus);
       console.log('streamId:',cfg.items[i].contentDetails.boundStreamId);
       if(liveFlag) {
       if (cfg.items[i].status.lifeCycleStatus == bStatus[1] ||
       cfg.items[i].status.lifeCycleStatus == bStatus[2] ||
       cfg.items[i].status.lifeCycleStatus == bStatus[3]) {
       if (cfg.items[i].snippet.title.indexOf(uName + '-' + duid) > -1) {
       liveFlag = false;
       vid = cfg.items[i].id;
       sid = cfg.items[i].contentDetails.boundStreamId;
       bdstatus = cfg.items[i].status.lifeCycleStatus;
       }
       }
       }
       }*/

      if(!( cfg && cfg.id )){
        //'rtsp://104.155.214.170/GACWPNS291O6U46L0SC4'
        console.log('do live :',streamSrc );
        doLiveStream(auth,youtube,streamSrc,uName,duid,next);
      } else {
        vid = cfg.id,sid = cfg.contentDetails.boundStreamId,bdstatus = cfg.status.lifeCycleStatus;
        listStream(auth,youtube,sid,function(err,streams){
          var stream = streams.items[0];
          var streamName, streamAddress;
          if (err) {
            console.log(err);
            return next(501,{code:501,msg:'List stream -'+err.message});
          }
          streamId = stream.id;
          streamName = stream.cdn.ingestionInfo.streamName;
          streamAddress = stream.cdn.ingestionInfo.ingestionAddress;
          streamUrl = streamAddress + '/' + streamName;
          console.log('Stream ID: ' + streamId + '/// url:' + streamUrl);
          var streamConfig = {
            sid : streamId,
            sname : streamName,
            surl : streamUrl,
            status : (bdstatus && bdstatus==bStatus[3])?2:(bdstatus && bdstatus==bStatus[2])?1:0
          }
          //check live stream than alert network error.
          processStream(auth,youtube,liveCfg.rtspSource,vid,streamConfig,function(err,result){
            //do webhook ...
          });
          next(null,{
            code : 200,
            msg : 'Success',
            eventId : vid,
            url : 'https://www.youtube.com/watch?v='+vid,
            eventStatus : bdstatus
          });

        });
      }
    });
  });
}
