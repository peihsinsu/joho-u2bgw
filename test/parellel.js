 var async = require('async');
 var log4js = require('log4js');
 log4js.configure('log.config', {});
 var logger = log4js.getLogger('test');
 logger.info('xxxxxxxxxxxxxxxxxx');
 var log= console.log;
 var fire = function(obj, callback, timeout) {
  //直接将obj的内容返回给async
    timeout = timeout || 200;
    setTimeout(function() {
        callback(null, obj);
    }, timeout);
};
//json input
async.parallel({
   live : function(cb) { fire([{a:1,b:2}], cb, 400) },
   testing : function(cb) { fire([{c:3,d:4}],cb, 300) }
}, function(err, results) {
    log('1.3 err: ', err);
    log('1.3 results: ', results);
});
//array input
async.parallel([
    function(cb) { fire('a400', cb, 400) },
    function(cb) { fire('a200', cb, 200) },
    function(cb) { fire('a300', cb, 300) }
], function (err, results) {
    log('1.1 err: ', err);
    log('1.1 results: ', results);
});
//不會列出所有RESULT, 死在哪就停在執行完的步驟
async.waterfall([
    function(cb) { log('1.1.1: ', 'start'); cb(null, {a:3}); },
    function(n, cb) { log('1.1.2: ',n.a); cb('err',{b:n.a+1}); },
    function(n, cb) { log('1.1.3: ',n.b); cb(null,n.b*2); }
], function (err, result) {
    log('1.1.4 err: ', err);
    log('1.1.5 result: ', result);
});
function next(){
  return console.log('THE END ...');
}
function test(next){
  err = 'y';
  async.auto({
    getOne : function(cb,results){
      log('getOne',results);
      if(err)
        return next();
      cb(null,{one:1});
    },
    getTwo : function(cb,results){
      log('getTwo',results);
      cb('err',{two:2}); 
    },
    getThree : function(cb,results){
      log('getThree',results);
      cb(null,{three:3});
    }
  },
  function(err, results) {
    log('1.2 err: ', err);
    log('1.2 results: ', results);
  }  );

}
test(next);
