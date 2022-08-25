const initOptions = {
   
};

const pgp = require('pg-promise')(initOptions);
var dbConnection



let cn = global.Config.parse.databaseURI;

if(global.isLocal){
    cn = global.Config.parse.databaseURIOnline;
}
if(!dbConnection){
    dbConnection = pgp(cn);
}


module.exports = dbConnection