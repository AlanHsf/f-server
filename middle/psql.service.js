const initOptions = {
    // initialization options;
};

const pgp = require('pg-promise')(initOptions);
var dbConnection

// const db = ()=>{

let cn = global.Config.parse.databaseURI;

if(global.isLocal){
    cn = global.Config.parse.databaseURIOnline;
}
if(!dbConnection){
    dbConnection = pgp(cn);
}
    // return dbConnection
// }

module.exports = dbConnection