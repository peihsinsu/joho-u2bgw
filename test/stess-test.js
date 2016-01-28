"use strict";
var googleapis = require('googleapis');
var flow = require('async');
var moment = require('moment');
var serviceAccount = require('../config/client_secret.json').installed;
var isDebug = false;
function getAuth(secretStore,tokenStore,next){
    var auth = new googleapis.auth.OAuth2(
        secretStore.client_id,
        secretStore.client_secret,
        secretStore.redirect_uri);
    auth.setCredentials(tokenStore);
    if(isDebug){
        console.log('auth -----------------------');
        console.log('auth look like:',auth);
        console.log('auth -----------------------');
    }

    if(next)
        next(null,auth);
    else
        return auth;
}
function addBroadCase( auth, youtube, uName, duid, nName, next) {
    //** CHANGE GET DATE WITH CODE
    var sDate = new Date(new Date().getTime()+30*1000);
    var eDate = new Date(sDate.getFullYear()+1,sDate.getMonth(),sDate.getDate(),sDate.getHours(),sDate.getMinutes());
    var reqBroadcast = {
        part: 'snippet,status',
        resource: {
            snippet: {
                scheduledStartTime: moment(sDate).format('YYYY-MM-DDTHH:mm:ss.sZ'),
                scheduledEndTime: moment(eDate).format('YYYY-MM-DDTHH:mm:ss.sZ'),
                title: nName + '-' + uName + '-' + duid + '-' + moment(sDate).format('YYYYMMDDHHmm')
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
        console.log('######## step insert broadcast.######## ',new Date());
        console.log('Video ID: ' + bid);
        if(isDebug) console.log(err,reqBroadcast);
        next(err,bid);
    });
}
function listEvent( auth, youtube, status, vid, next ){
    var listArg = {
        part: 'id,snippet,contentDetails,status',
        maxResults : 50 ,
        auth:auth
    }
    if(status) listArg.broadcastStatus = status ;
    else if(vid) listArg.id = vid ;
    else listArg.mine = true;
    youtube.liveBroadcasts.list( listArg, function(err, broadcasts){
        console.log('list broads=====>',err?'fail':'success');
        next(err,vid);
    });
}


//cost api 5 units quota
function addStream( auth, youtube, uname, duid, next) {
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
            var streamId = stream.id;
            streamName = stream.cdn.ingestionInfo.streamName;
            streamAddress = stream.cdn.ingestionInfo.ingestionAddress;
            var streamUrl = streamAddress + '/' + streamName;
            console.log(uname,new Date(),'######## step insert stream :['+streamId+'].########');
            console.log('Stream ID: ' + streamId + '/// url:' + streamUrl);
        }

        next(err,streamId);
    });
}

//cost api 3 units quota
//hit :error - null ，實際上已bind 完成, 可以再bind一次, 或直接query stream 即可 …
function bindStream(auth,youtube,streamId,videoId,una ,next) {
    var bindArgs = {
        part: 'id,contentDetails',
        id: videoId,
        streamId: streamId,
        auth: auth
    };
    youtube.liveBroadcasts.bind(bindArgs, function (err, bind) {
        console.log(una,'######## step bind broadcast + stream .########',videoId,streamId);
        delete bindArgs.auth;
        bindArgs.api = 'Broadcast Bind';
        bindArgs.msg = bind;
        //doLog(err,bindArgs);
        if(err) console.log(una,'VVVVVV-->',err,err.message,err.code);
        if(err && (err.code==500 || err.code=='500') && (err.message==null || err.message == 'null')){
            err = null;
        }
        next(err,{vid:videoId,sid:streamId});
    });
}
/*
 "id": "0COI9XLKagO6Hs0V3fhdog1450764552539142",
 "snippet": {
 "publishedAt": "2015-12-22T06:09:12.000Z",
 "channelId": "UC0COI9XLKagO6Hs0V3fhdog",
 "title": "sunny122009-GACWPNS291O6U46L0SC4",
 "description": "",
 "isDefaultStream": false
 },
 "cdn": {
 "format": "720p",
 "ingestionType": "rtmp",
 "ingestionInfo": {
 "streamName": "sunnyhu573.7qxu-j79v-qjym-dy27",
 "ingestionAddress": "rtmp://a.rtmp.youtube.com/live2",
 "backupIngestionAddress": "rtmp://b.rtmp.youtube.com/live2?backup=1"
 }
 },
 "status": {
 "streamStatus": "inactive",
 "healthStatus": {
 "status": "noData"
 }
 }
 },
 */
function listStream(auth,youtube,streamId,una,next){
    var listArg = {
        part: 'id,snippet,cdn,status',
        maxResults : 50 ,
        auth:auth
    }
    if(streamId) listArg.id = streamId ;
    else{
        listArg.mine = true;
        listArg.maxResults = 50;
    }
    youtube.liveStreams.list(listArg,function(err, streams){
        console.log(una,'######## step list stream :'+(streamId?streamId:'mine')+'  .########');
        if(!streamId && streams){
            for(let stream of streams.items){
                //console.log('Stream info:',stream);
                if(stream.snippet.title.indexOf(una)>-1 && (stream.status.streamStatus=='ready'||stream.status.streamStatus=='inactive')){
                    console.log('find the same stream');
                    streamId = stream.id;
                    break;
                }

            }
        }
        next(err,streamId);
    });
};

function doTest(uname,nname,duid){
    var youtube = googleapis.youtube('v3');
    var uToken = process.argv[2];
    var auth;
    var step;
  flow.waterfall([
      function(cb){
          step = 'DO AUTH';
          if(!auth){
              getAuth(serviceAccount,{
                  access_token : uToken,
                  token_type : 'Bearer'
              },cb);
          }else cb(null,auth)

      },function(cauth,cb){
          //console.log('XXXXXXXXXX:',cauth);
          auth = cauth;
          step = 'ADD BROADCAST';
          addBroadCase(auth,youtube,uname,duid,nname,cb);
      },function(vid,cb){
          vids.push(vid);
          listEvent(auth,youtube,null,vid,cb);
      },function(vid,cb){
          step = 'ADD STREAM';
          listStream(auth,youtube,null,uname,function(e,r){
              if(r){
                  cb(null,{vid:vid,sid:r})
              }else{

                  addStream(auth,youtube,uname,duid,function(e,r){
                      if(e) cb(e);
                      else{
                          console.log('success add stream :',r);
                          cb(null,{vid:vid,sid:r})
                      }
                  });
              }

          });

      },function(vsid,cb){
          step = 'BIND STREAM';
          bindStream(auth,youtube,vsid.sid,vsid.vid,uname,cb);
      },
      function(vsid,cb){
          //delete event
          step = 'DELETE EVENT';
          if(isDelete){
              //console.log('vids:',vids);
              youtube.liveBroadcasts.delete({id:vsid.vid,auth:auth},function(e,r){console.log(e?'delete event err:':'delete event success:',uname,vsid.vid,e),cb(null,vsid)});

          }else cb(null,vsid)

      },
      function(vsid,cb){
          //delete event
          if(isDelete){
              //console.log('vids:',vids);
              //youtube.liveStreams.delete({id:vsid.sid,auth:auth},function(e,r){console.log(e?'delete stream err:':'delete stream success:',uname,vsid.sid,e);cb(null,vsid)});
          }else cb(null,vsid);

      }
    ],function(err,result){
      console.log(step,'+++++++++++++++++++++++',uname);
      console.log(err?'fale:':'success:',uname,err);
      console.log('result:',uname,result);
      console.log('+++++++++++++++++++++++');
    }
  );
}

function doStreamTest(uname,duid){
    var youtube = googleapis.youtube('v3');
    var uToken = process.argv[2];
    var auth;
    flow.waterfall([
            function(cb){
                if(!auth){
                    getAuth(serviceAccount,{
                        access_token : uToken,
                        token_type : 'Bearer'
                    },cb);
                }else cb(null,auth)

            },function(cauth,cb){
                auth = cauth;
                addStream(auth,youtube,uname,duid,cb);
            },function(sid,cb){
                listStream(auth,youtube,sid,cb);
            },
            function(sid,cb){
                //delete event
                if(isDelete){
                    console.log('del stream:',sid);
                    youtube.liveStreams.delete({id:sid,auth:auth},function(e,r){console.log('delete err:',uname,sid,e);cb(null,sid)});
                }else cb(null,sid);

            }
        ],function(err,result){
            console.log('+++++++++++++++++++++++',uname);
            console.log(err?'fale:':'success:',uname,err);
            console.log('result:',new Date(),uname,result);
            console.log('+++++++++++++++++++++++');
        }
    );
}

if(!process.argv[2]){
    return console.log('need token');
}

if(!process.argv[3]){
    console.log('Use default max 5 times');
}
var count = 0;
var max = process.argv[3] || 5;
var secLimit = 1;
var vids = [];
var isDelete = true;
var iid = setInterval(function(){
    for(let j=0;j<secLimit;j++){

        count ++;
        doTest('sunny-'+count,'測試-'+count,'duid-'+count);
        console.log('測試-'+count,'done****',new Date());
        if(count==max){ break; }
    }
    if(count == max ){
        clearInterval(iid);
    }
},300);


/*flow.doWhilst(
    //function () { return count < 5; },
    function (cb) {
        count++;
        //console.log('count,max:',count,max);
        doTest('sunny-'+count,'測試-'+count,'duid-'+count);
        //doStreamTest('sunny-'+count,'duid-'+count);
        cb(null,count);
    },
    function () {
        return count < parseInt(max);
    },
    function (err, r) {
        // 5 seconds have passed, n = 5
        console.log('----------------------->');
        console.log('error:',err);
        //console.log('result:'+count+':',r);
        console.log('<-----------------------');

    }
);*/
