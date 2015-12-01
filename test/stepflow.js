/**
 * Created by sunnyhu on 15/10/25.
 */
var sunny_tokens = { access_token: 'ya29.FwJb7fnGJiPtO1m3ny7_2yAvPRmn97gthV9gnskBrsfKrmoaLO95nMjQnR4SVaehYocr',
  token_type: 'Bearer',
  refresh_token: '1/emzknGU5W_ZmE0Yzwo0DMLKve6cSrQ0sc92yzNRf7qU',
  expiry_date: 1445793271091 };

(function() {
  var rl, videoId, streamId, streamUrl, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, getAccessToken, auth, transitIt;
  var googleapis = require('googleapis');
  var moment = require('moment');
  var readline = require('readline');
  var ffmpeg = require('fluent-ffmpeg');
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  videoId = '';
  streamId = '';
  streamUrl = '';
  /*sunny54573這是您的用戶端 ID
   516742858450-a33kmlfflsjo1kqj9khcpjfefak272hn.apps.googleusercontent.com
   您的用戶端密鑰如下
   RvqFbHgXvEwG4prcDVccaB-B*/
  CLIENT_ID = '516742858450-a33kmlfflsjo1kqj9khcpjfefak272hn.apps.googleusercontent.com';
  //'161639684388-6c8utml7h4f05qv02m90721butpktt4l.apps.googleusercontent.com';
  CLIENT_SECRET = 'RvqFbHgXvEwG4prcDVccaB-B';
  //'KLzPuIuqbe1za7ueQMr_c1hj';
  REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';
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

  auth = new googleapis.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  //cost api 5 units quota
  transitIt = function (auth, status, videoId, next) {
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
  addBroadCast = function (next) {
    youtube.liveBroadcasts.insert(reqBroadcast, function (err, broadcast) {
      if (err) {
        return console.log(err);
      }
      videoId = broadcast.id;
      console.log('Video ID: ' + videoId);
      next(videoId);
    });
  };
  //cost api 5 units quota
  addStream = function (next) {
    youtube.liveStreams.insert(reqStream, function (err, stream) {
      var streamName, streamAddress;
      if (err) {
        return console.log(err);
      }
      streamId = stream.id;
      streamName = stream.cdn.ingestionInfo.streamName;
      streamAddress = stream.cdn.ingestionInfo.ingestionAddress;
      streamUrl = streamAddress + '/' + streamName;
      console.log('Stream ID: ' + streamId + '/// url:' + streamUrl);
      next(stream);
    });
  };
  //cost api 3 units quota
  bindStream = function (stream,videoId ,next) {
    youtube.liveBroadcasts.bind({
        part: 'id,contentDetails',
        id: videoId,
        streamId: stream.id,
        auth: auth
      }, function (err, bind) {
        console.log('bind ===>', bind);
        if (err) {
          return console.log(err);
        }
        next();
      }
    );
  };
  //cost api 3 units quota
  listStream = function(streamId,next){
    youtube.liveStreams.list({
      part: 'id,status',
      id: streamId,
      auth:auth
    },function(err, streams){
      console.log('list stream=====>',streams);
      next();
    });
  };


  var youtube = googleapis.youtube('v3');
  /* first time get token using - getAccessToken
  console.log('auth back :',getAccessToken(auth,function(){
    console.log('after get token next ...');
  }));*/
  //when we got access token
  auth.setCredentials(sunny_tokens);
  console.log('auth look like:',auth);
  console.log('auth -----------------------');
  var reqBroadcast, reqStream;
  reqBroadcast = {
    part: 'snippet,status',
    resource: {
      snippet: {
        scheduledStartTime: moment(new Date('2015', '10', '11', '23')).format('YYYY-MM-DDThh:mm:ss.sZ'),
        scheduledEndTime: moment(new Date('2015', '10', '13', '08')).format('YYYY-MM-DDThh:mm:ss.sZ'),
        title: 'first-live'
      },
      status: {
        privacyStatus: 'private'
      }
    },
    auth:auth
  };
  reqStream = {
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
  //first time register a live brocast and stream

  addBroadCast(function(videoId){
    console.log('add broad cast end');
    addStream(function(stream){
      bindStream(stream,videoId,function(){
        processStream(stream);
      });

    });
  });

  /*addStream(function(stream){
   console.log('add stream end',stream);
   });*/
  /*bindStream(stream.id,videoId,function(){
   console.log('end bind stream...');
   });*/
  /*listStream(stream.id,function(){
   console.log('end list stream...');
   });*/
  processStream(stream);
  var videoId = 'uTNpe071sLs';
  transitIt(auth,'live',videoId,function(err,it){
    if(err) console.log('transit error:',err);
    console.log('transit end...',it);
  });
  var stream = { kind: 'youtube#liveStream',
   etag: '"0KG1mRN7bm3nResDPKHQZpg5-do/BtSBUgWhDdqs7P143w6c8PMyg-g"',
   id: '0COI9XLKagO6Hs0V3fhdog1445791620843055',
   snippet:
   { publishedAt: '2015-10-25T16:47:00.000Z',
   channelId: 'UC0COI9XLKagO6Hs0V3fhdog',
   title: 'ly 240p',
   description: '',
   isDefaultStream: false },
   cdn:
   { format: '240p',
   ingestionType: 'rtmp',
   ingestionInfo:
   { streamName: 'sunnyhu573.mcv8-g8v3-sf0j-dsgf',
   ingestionAddress: 'rtmp://a.rtmp.youtube.com/live2',
   backupIngestionAddress: 'rtmp://b.rtmp.youtube.com/live2?backup=1' } } }
  var bind = { kind: 'youtube#liveBroadcast',
    etag: '"0KG1mRN7bm3nResDPKHQZpg5-do/VvN1OYTB-Vq1BRNgKx0UTqwgPak"',
    id: 'R2vTo86Nfbo',
    contentDetails:
    { boundStreamId: '0COI9XLKagO6Hs0V3fhdog1445791620843055',
      monitorStream:
      { enableMonitorStream: true,
        broadcastStreamDelayMs: 0,
        embedHtml: '<iframe width="425" height="344" src="https://www.youtube.com/embed/R2vTo86Nfbo?autoplay=1&livemonitor=1" frameborder="0" allowfullscreen></iframe>' },
      enableEmbed: true,
      enableDvr: true,
      enableContentEncryption: false,
      startWithSlate: false,
      recordFromStart: true,
      enableClosedCaptions: false,
      enableLowLatency: false } };
  var lStream = { kind: 'youtube#liveStreamListResponse',
    etag: '"0KG1mRN7bm3nResDPKHQZpg5-do/a3of2tAU3s05cTjLMZyNPVO3YXM"',
    pageInfo: { totalResults: 0, resultsPerPage: 5 },
    items:
        [ { kind: 'youtube#liveStream',
          etag: '"0KG1mRN7bm3nResDPKHQZpg5-do/E1Ghy2hLeG1VQs8DCxR-HMQGf0E"',
          id: '0COI9XLKagO6Hs0V3fhdog1445791620843055',
          status: { streamStatus: 'active', healthStatus: { status: 'good' } }
        } ] };
  var flag = true;
  function processStream(stream){
    var fmpg = new ffmpeg({
          source: 'rtsp://104.155.214.170/GACWPNS291O6U46L0SC4'//'test.flv'//
        }
    ).addInputOption('-re').addInputOption('-rtsp_transport tcp')
    .withVideoCodec('libx264')
    .withAudioBitrate('128k')
    .withAudioChannels(2)
    .withAudioFrequency(44100)
    //.withSize('1280x720')
    .withFps(30).toFormat('flv')
    .addOptions(['-g 1', '-force_key_frames 2'])
    .on('start', function(it){
      return console.log('FFmpeg start with ' + it);
    }).on('progress', function(){
      console.log('progress video...');
      /*if(flag){
        youtube.liveStreams.list({
          part: 'id,status',
          id: stream.id,
          auth:auth
        },function(err, streams){
          console.log(streams.items[0].status);
          transitIt(auth,'testing',videoId, function(err, test){
            if(err) console.log('transitIt testing error:',err);
            console.log('transit test:',test);
            transitIt(auth, 'live',videoId, function(err, live){
              if(err) console.log('transitIt error:',err);
              if (live) {
                return console.log(live);
              }
              //flag = false;
            });
          });
        });
      }*/

    }).on('end', function(){
      return console.log('FFmpeg end.');
    }).save(stream.cdn.ingestionInfo.ingestionAddress + '/' + stream.cdn.ingestionInfo.streamName);
  }

  //googleapis.discover('youtube', 'v3').execute(function(err, client){
  /*return getAccessToken(auth, function(){
    var reqBroadcast, reqStream;
    reqBroadcast = {
      part: 'snippet,status',
      resource: {
        snippet: {
          scheduledStartTime: moment(new Date('2015', '10', '11', '23')).format('YYYY-MM-DDThh:mm:ss.sZ'),
          scheduledEndTime: moment(new Date('2015', '10', '13', '08')).format('YYYY-MM-DDThh:mm:ss.sZ'),
          title: 'first-live'
        },
        status: {
          privacyStatus: 'private'
        }
      },
      auth:auth
    };
    reqStream = {
      part: 'snippet,cdn',
      resource: {
        snippet: {
          title: 'ly 240p'
        },
        cdn: {
          format: '240p',
          ingestionType: 'rtmp'
        }
      },
      auth:auth
    };
    return youtube.liveBroadcasts.insert(reqBroadcast,function(err, broadcast){
      if (err) {
        return console.log(err);
      }
      videoId = broadcast.id;
      console.log('Video ID: ' + videoId);
      return youtube.liveStreams.insert(
          reqStream,function(err, stream){
            var streamName, streamAddress;
            if (err) {
              return console.log(err);
            }
            streamId = stream.id;
            streamName = stream.cdn.ingestionInfo.streamName;
            streamAddress = stream.cdn.ingestionInfo.ingestionAddress;
            streamUrl = streamAddress + '/' + streamName;
            console.log('Stream ID: ' + streamId + '/// url:'+streamUrl);
            return youtube.liveBroadcasts.bind({
              part: 'id,contentDetails',
              id: videoId,
              streamId: streamId,
              auth:auth
            },function(err, bind){
              if (err) {
                return console.log(err);
              }
              return new ffmpeg({
                    source: 'test.flv'//'rtsp://104.155.214.170/GACWPNS291O6U46L0SC4'
                  }
              )//.addInputOption('-rtsp_transport tcp')
                  .withVideoCodec('libx264').withAudioBitrate('128k').withAudioChannels(2).withAudioFrequency(44100).withSize('426x240').withFps(30).toFormat('flv').addOptions(['-g 1', '-force_key_frames 2'])
                  .on('start', function(it){
                    return console.log('FFmpeg start with ' + it);
                  }).on('progress', function(){
                    return youtube.liveStreams.list({
                      part: 'id,status',
                      id: streamId,
                      auth:auth
                    },function(err, streams){
                      //return transitIt(auth, client, 'testing', function(err, test){
                      return transitIt(auth, 'live', function(err, live){
                        if (live) {
                          return console.log(live.status);
                        }
                      });
                      //});
                    });
                  }).on('end', function(){
                    return console.log('FFmpeg end.');
                  }).save(streamUrl);//.writeToStream(streamUrl);
            });
          });
    });
  });
  //});*/
}).call(this);

