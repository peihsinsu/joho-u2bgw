(function(){
  var rl, videoId, streamId, streamUrl, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, getAccessToken, auth, transitIt;
  //require(['googleapis', 'request', 'moment', 'readline', 'fluent-ffmpeg']);
  var googleapis = require('googleapis');
//var request = require('request');
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
  CLIENT_ID = '161639684388-6c8utml7h4f05qv02m90721butpktt4l.apps.googleusercontent.com';

  CLIENT_SECRET = 'KLzPuIuqbe1za7ueQMr_c1hj';
  REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';
  getAccessToken = function(auth, next){
    var url;
    url = auth.generateAuthUrl({
      access_type: 'offline',
      scope: 'https://www.googleapis.com/auth/youtube'
    });
    console.log('Vist the url: ' + url);
    return rl.question('Enter the Code:', function(code){
      return auth.getToken(code, function(err, tokens){
        auth.setCredentials(tokens);
        return next();
      });
    });
  };
  auth = new googleapis.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  transitIt = function(auth, status, next){
    return youtube.liveBroadcasts.transition({
      broadcastStatus: status,
      id: videoId,
      part: 'id,status,contentDetails',
      auth:auth
    },function(err, it){
      return next(err, it);
    });
  };
  var youtube = googleapis.youtube('v3');

  //googleapis.discover('youtube', 'v3').execute(function(err, client){
    return getAccessToken(auth, function(){
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
  //});
}).call(this);
