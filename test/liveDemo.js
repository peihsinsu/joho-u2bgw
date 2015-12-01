/**
 * Created by sunnyhu on 15/11/1.
 * BROADCAST NAME = {  }
 */
var googleapis = require('googleapis');
var moment = require('moment');
//var readline = require('readline');
var ffmpeg = require('fluent-ffmpeg');
var streamStatus = {
  0 : 'created',
  1 : 'ready',
  2 : 'testing',
  3 : 'live',
  4 : 'complete'
};
var streamSrc = '/Users/sunnyhu/Movies/MyStream_0.mp4';
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

function getAccessToken(auth, next) {
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

function getAuth(secretStore,tokenStore,next){
  //change it to get with json file
  var auth = new googleapis.auth.OAuth2(
      secretStore.client_id,
      secretStore.client_secret,
      secretStore.redirect_uri);
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
function transitIt(auth,youtube, status, videoId, next) {
  return youtube.liveBroadcasts.transition({
    broadcastStatus: status,
    id: videoId,
    part: 'id,status,contentDetails',
    auth: auth
  }, function (err, it) {
    return next(err, it);
  });
};
//cost api 5 units quota
function addBroadCast(auth,youtube,next) {
  //** CHANGE GET DATE WITH CODE
  var sDate = new Date(new Date().getTime()+30*1000);
  var eDate = new Date(sDate.getFullYear()+1,sDate.getMonth(),sDate.getDate(),sDate.getHours(),sDate.getMinutes());
  var reqBroadcast = {
    part: 'snippet,status',
    resource: {
      snippet: {
        scheduledStartTime: moment(sDate).format('YYYY-MM-DDThh:mm:ss.sZ'),
        scheduledEndTime: moment(eDate).format('YYYY-MM-DDThh:mm:ss.sZ'),
        title: 'QEEK-live'
      },
      status: {
        privacyStatus: 'private'
      }
    },
    auth:auth
  };
  console.log('Insert broad case arg : ',reqBroadcast.resource.snippet.scheduledStartTime);
  youtube.liveBroadcasts.insert(reqBroadcast, function (err, broadcast) {
    if (err) {
      console.log('add broadcast error ',err);
      return next(err);
    }
    videoId = broadcast.id;
    console.log('Video ID: ' + videoId);
    next(null,videoId);
  });
};
//cost api 5 units quota
function addStream(auth,youtube,next) {
  var reqStream = {
    part: 'snippet,cdn',
    resource: {
      snippet: {
        title: '720p'
      },
      cdn: {
        format: '720p',
        ingestionType: 'rtmp'
      }
    },
    auth:auth
  };
  youtube.liveStreams.insert(reqStream, function (err, stream) {
    var streamName, streamAddress;
    if (err) {
      console.log(err);
      return next(err)
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
      status : 0
    }
    next(null,streamConfig);
  });
};
//cost api 3 units quota
function bindStream(auth,youtube,streamId,videoId ,next) {
  youtube.liveBroadcasts.bind({
    part: 'id,contentDetails',
    id: videoId,
    streamId: streamId,
    auth: auth
  }, function (err, bind) {
    console.log('bind ===>', bind);
    if (err) {
      console.log(err);
      return next(err);
    }
    next();
  });
};
//cost api 3 units quota , add status -> broadcastStatus : all / completed / active / upcoming
/*
 items[i]
 snippet.title
 status.lifeCycleStatus -> ready , testing , live , completed
 contentDetails.boundStreamId
 .monitorStream.embedHtml
 */
function listBroadCast(auth,youtube,status,next){
  var listArg = {
    part: 'id,snippet,contentDetails,status',
    broadcastStatus : 'all',
    auth:auth
  }
  if(status) listArg.broadcastStatus = status ;
  console.log('List args :',listArg);
  //if(status) listArg.broadcastStatus = status;
  youtube.liveBroadcasts.list(listArg,function(err, broadcasts){
    if(err){
      console.log(err);
      return next(err);
    }
    console.log('list stream=====>',broadcasts);
    next(null,broadcasts);
  });
};

function listStream(auth,youtube,streamId,next){
  var listArg = {
    part: 'id,cdn,status',
    id : streamId,
    //mine: true,
    auth:auth
  }
  //if(streamId) listArg.id = streamId ;
  console.log('List args :',listArg);
  //if(status) listArg.broadcastStatus = status;
  youtube.liveStreams.list(listArg,function(err, streams){
    if(err){
      console.log(err);
      return next(err);
    }
    console.log('list stream=====>',streams);
    next(null,streams);
  });
};

function processStream(auth,youtube,rtspSrc,vid,streamConfig){
  var fmpg = new ffmpeg({
    source: rtspSrc // 'rtsp://104.155.214.170/GACWPNS291O6U46L0SC4'//'test.flv'//
  })
      .addInputOption('-re')
    //.addInputOption('-rtsp_transport tcp')
    //.withVideoCodec('libx264')
      .withAudioBitrate('128k')
      .withAudioChannels(2)
      .withAudioFrequency(44100)
    //.withSize('1280x720')
      .withFps(30).toFormat('flv')
      .addOptions(['-g 1', '-force_key_frames 2'])
      .on('start', function(it){
        var retryCnt = 8;
        setInterval(function(){
          if( retryCnt < 10 ){
            retryCnt +=1 ;
            //list stream by ID ,but consider multi camera used.
            listStream(auth,youtube,streamConfig.sid,function(err,stream){
              //see status ...
              for(var i=0;i<stream.items.length;i++){
                var item = stream.items[i];
                var sstatus =item.status.streamStatus; //item.status.lifeCycleStatus;
                console.log('transit:',retryCnt,item.status,sstatus==streamStatus[1],streamConfig.status,stream);

                //READY , must add broadcast status = testing check
                if(sstatus=='active'){
                  transitIt(auth,youtube,streamStatus[2],vid,function(err,it){
                    console.log('-- transit tesing -->',streamStatus[2],it);
                    if(err){
                      console.log(err);
                    }
                    //if( !err || ( err && sstatus==streamStatus[2] ) ){
                    setTimeout(function(){
                      transitIt(auth,youtube,streamStatus[3],vid,function(err,it){
                        console.log('-- transit live -->',streamStatus[3],it);
                        if(err){
                          console.log(err);
                          streamConfig.status == 1;
                        }else{
                          streamConfig.status == 1;
                        }
                      })
                    },10000);
                    //}
                  });

                }
              }
            });
          }
        },10000);
        return console.log('FFmpeg start with ' + it);
      })
      .on('progress', function(){
        //console.log('progress video...');
        //ADD SLOW DOWN ...

      })
      .on('end', function(){
        //hook to frontend
        return console.log('FFmpeg end.');
      })
      .on('error', function(err, stdout, stderr) {
        console.log('Cannot process video: ' + err.message);
      })
      .save(streamConfig.surl);
}

var doLiveStream = function(auth,youtube,rtspUrl){
  addBroadCast(auth,youtube,function(err,videoId){
    console.log('add broad cast end',videoId);
    if(err) return ;
    addStream(auth,youtube,function(err,streamConfig){
      bindStream(auth,youtube,streamConfig.sid,videoId,function(err){
        processStream(auth,youtube,rtspUrl,videoId,streamConfig);
      });
    });
  });
}

//LIVE STREAM SCENARIO
//Must control query stream with other name , must query all system built live events.
var youtube = googleapis.youtube('v3');
getAuth(serviceAccount,sunnyToken,function(err,auth){
  //listStream(auth,youtube,'0COI9XLKagO6Hs0V3fhdog1446305048563691',function(err,cfg){
  var liveFlag = true;
  listBroadCast(auth,youtube,'upcoming',function(err,cfg){
    console.log('Error ..:',err);
    vid = '';
    sid = '';
    for(var i=0;i<cfg.items.length;i++){
      //console.log(cfg.items[i].status);
      console.log('title:',cfg.items[i].snippet.title);
      console.log('status:',cfg.items[i].status.lifeCycleStatus);
      console.log('streamId:',cfg.items[i].contentDetails.boundStreamId);
      if(liveFlag) {
        if (cfg.items[i].status.lifeCycleStatus == streamStatus[1] ||
            cfg.items[i].status.lifeCycleStatus == streamStatus[2] ||
            cfg.items[i].status.lifeCycleStatus == streamStatus[3]) {
          //if (cfg.items[i].snippet.title.indexOf('QEEK') > -1) {
            liveFlag = false;
            vid = cfg.items[i].id;
            sid = cfg.items[i].contentDetails.boundStreamId;
          //}
        }
      }
    }
    if(liveFlag){
      doLiveStream(auth,youtube,streamSrc);
    } else {
      listStream(auth,youtube,sid,function(err,streams){
        var stream = streams.items[0];
        var streamName, streamAddress;
        if (err) {
          console.log(err);
          return next(err)
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
          status : 0
        }
        processStream(auth,youtube,streamSrc,vid,streamConfig);
      });
    }
  });

});

/* after bind
 {

 "kind": "youtube#liveBroadcast",
 "etag": "\"0KG1mRN7bm3nResDPKHQZpg5-do/xEdNDKaQ3NWs3C0gs1pZwSZjCdQ\"",
 "id": "5t6pEUQC2pA",
 "status": {
 "lifeCycleStatus": "liveStarting",
 "privacyStatus": "private",
 "recordingStatus": "recording"
 }
 }
 after list broadcast
 "items": [
 {

 "kind": "youtube#liveBroadcast",
 "etag": "\"0KG1mRN7bm3nResDPKHQZpg5-do/cTq8_7yYhqsrdnA9wXaRZjlBEjM\"",
 "id": "iaeUGglAP7s",
 "snippet": {
 "publishedAt": "2015-11-01T02:48:56.000Z",
 "channelId": "UC0COI9XLKagO6Hs0V3fhdog",
 "title": "live-01",
 "description": "",
 "thumbnails": {
 "default": {
 "url": "https://i.ytimg.com/vi/iaeUGglAP7s/default_live.jpg",
 "width": 120,
 "height": 90
 },
 "medium": {
 "url": "https://i.ytimg.com/vi/iaeUGglAP7s/mqdefault_live.jpg",
 "width": 320,
 "height": 180
 },
 "high": {
 "url": "https://i.ytimg.com/vi/iaeUGglAP7s/hqdefault_live.jpg",
 "width": 480,
 "height": 360
 }
 },
 "scheduledStartTime": "2015-11-01T03:00:00.000Z",
 "isDefaultBroadcast": false,
 "liveChatId": "Cg0KC2lhZVVHZ2xBUDdz"
 },
 "status": {
 "lifeCycleStatus": "ready",
 "privacyStatus": "public",
 "recordingStatus": "notRecording"
 },
 "contentDetails": {
 "boundStreamId": "0COI9XLKagO6Hs0V3fhdog1446347227063597",
 "monitorStream": {
 "enableMonitorStream": true,
 "broadcastStreamDelayMs": 0,
 "embedHtml": "<iframe width=\"425\" height=\"344\" src=\"https://www.youtube.com/embed/iaeUGglAP7s?autoplay=1&livemonitor=1\" frameborder=\"0\" allowfullscreen></iframe>"
 },
 "enableEmbed": true,
 "enableDvr": true,
 "enableContentEncryption": false,
 "startWithSlate": false,
 "recordFromStart": true,
 "enableClosedCaptions": false,
 "enableLowLatency": false
 }
 }
 ]
 after list stream
 "items": [
 {

 "kind": "youtube#liveStream",
 "etag": "\"0KG1mRN7bm3nResDPKHQZpg5-do/nkIIohBvaUvgEbLLQKanwcnNAg8\"",
 "id": "0COI9XLKagO6Hs0V3fhdog1446347227063597",
 "snippet": {
 "publishedAt": "2015-11-01T03:07:07.000Z",
 "channelId": "UC0COI9XLKagO6Hs0V3fhdog",
 "title": "Basic stream",
 "description": "Generic basic stream.",
 "isDefaultStream": false
 },
 "cdn": {
 "format": "720p",
 "ingestionType": "rtmp",
 "ingestionInfo": {
 "streamName": "sunnyhu573.fdtg-xs2s-w2m0-cx60",
 "ingestionAddress": "rtmp://a.rtmp.youtube.com/live2",
 "backupIngestionAddress": "rtmp://b.rtmp.youtube.com/live2?backup=1"
 }
 },
 "status": {
 "streamStatus": "active",  //THIS CAN BE TRANSIT TO TESTING
 "healthStatus": {
 "status": "good"
 }
 }
 }
 ]

 after transit

 {

 "kind": "youtube#liveBroadcast",
 "etag": "\"0KG1mRN7bm3nResDPKHQZpg5-do/af2dshJtuIHnSyjacAfmARB32tY\"",
 "id": "iaeUGglAP7s",
 "snippet": {
 "publishedAt": "2015-11-01T02:48:56.000Z",
 "channelId": "UC0COI9XLKagO6Hs0V3fhdog",
 "title": "live-01",
 "description": "",
 "thumbnails": {
 "default": {
 "url": "https://i.ytimg.com/vi/iaeUGglAP7s/default_live.jpg",
 "width": 120,
 "height": 90
 },
 "medium": {
 "url": "https://i.ytimg.com/vi/iaeUGglAP7s/mqdefault_live.jpg",
 "width": 320,
 "height": 180
 },
 "high": {
 "url": "https://i.ytimg.com/vi/iaeUGglAP7s/hqdefault_live.jpg",
 "width": 480,
 "height": 360
 }
 },
 "scheduledStartTime": "2015-11-01T03:00:00.000Z",
 "isDefaultBroadcast": false,
 "liveChatId": "Cg0KC2lhZVVHZ2xBUDdz"
 },
 "status": {
 "lifeCycleStatus": "testStarting",
 "privacyStatus": "public",
 "recordingStatus": "notRecording"
 },
 "contentDetails": {
 "boundStreamId": "0COI9XLKagO6Hs0V3fhdog1446347227063597",
 "monitorStream": {
 "enableMonitorStream": true,
 "broadcastStreamDelayMs": 0,
 "embedHtml": "<iframe width=\"425\" height=\"344\" src=\"https://www.youtube.com/embed/iaeUGglAP7s?autoplay=1&livemonitor=1\" frameborder=\"0\" allowfullscreen></iframe>"
 },
 "enableEmbed": true,
 "enableDvr": true,
 "enableContentEncryption": false,
 "startWithSlate": false,
 "recordFromStart": true,
 "enableClosedCaptions": false,
 "enableLowLatency": false
 }
 }
 */



