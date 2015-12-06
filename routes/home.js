var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/', function(req, res, next) {

  res.send({app:'u2bapi-gateway',version:'1.0.0'});

});
module.exports = router;
