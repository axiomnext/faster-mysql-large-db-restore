var fs = require('fs');
var json = {};

//console.log(index + ': ' + val);
json.strTables = process.argv[2];
json.takeProcedure = process.argv[3];
json.host = process.argv[4];
json.port = process.argv[5];
json.userName = process.argv[6];
json.password = process.argv[7];
json.dbName = process.argv[8];
json.target_path = process.argv[9]; 
json.fileName = process.argv[10];

json.fileTS = new Date().getTime().toString();

var c = require('mysql').createConnection({
    host: json.host,
    user: json.userName,
    password: json.password,
    database: json.dbName,
    multipleStatements: true
});

c.connect(function (err) {
    if (err) {
        console.log(['c.connect', err]);
    }
    else {
        c.on('error', function (e) {
            console.log(e);
        });
        c.query("SHOW TABLES;", function (err, results, fields) {
            if (err) {
                console.log(err);
            }
            else {
                if (results.length > 0) {
                    var fieldName = Object.keys(results[0])[0];

                    var arrIgnoreTables = [];
                    var ignoreTablesStr = '';
                    if (json.strTables != '') {
                        arrIgnoreTables = json.strTables.toString().split(',');
                        if (arrIgnoreTables.length > 0) {
                            for (var i = 0; i < arrIgnoreTables.length; i++) {
                                ignoreTablesStr += " --ignore-table=" + json.dbName + ".'" + arrIgnoreTables[i] + "'";
                            }
                        }
                    }

                    getKeys(results, fieldName, [], 0, results.length, json, ignoreTablesStr, arrIgnoreTables, c);
                }
            }

        });
    }
});


function getKeys(arrTables, fieldName, arrKeys, currIndex, count, json, ignoreTablesStr, arrIgnoreTables, clinet) {
    
    if (currIndex < count) {
        
        if (arrIgnoreTables.indexOf(arrTables[currIndex][fieldName]) == -1) {
            //console.log(arrTables[currIndex][fieldName]);
            // console.log(json);
            
            var query = "select S1.INDEX_NAME as Key_name, S1.SEQ_IN_INDEX as Seq_in_index, S1.COLUMN_NAME as Column_name, S1.SUB_PART as Sub_part from (select * from information_schema.STATISTICS S where S.TABLE_SCHEMA='" + json.dbName + "' and S.TABLE_NAME='" + arrTables[currIndex][fieldName] + "') S1 ";
            query += "LEFT JOIN (SELECT * FROM information_schema.KEY_COLUMN_USAGE K where K.TABLE_SCHEMA='" + json.dbName + "' and K.TABLE_NAME='" + arrTables[currIndex][fieldName] + "') K1 ";
            query += "on S1.COLUMN_NAME = K1.COLUMN_NAME ";
            query += "WHERE K1.TABLE_SCHEMA is null;";
            
            clinet.query(query, function (err, results, fields) {
                if (err) {
                    console.log(err);
                }
                else {
                    if (results.length > 0) {
                        arrKeys['`' + arrTables[currIndex][fieldName] + '`'] = {};
                        for (var i = 0; i < results.length; i++) {
                            if (results[i].Non_unique != 0) {
                                if (arrKeys['`' + arrTables[currIndex][fieldName] + '`']['`' + results[i].Key_name + '`'] == undefined) {
                                    arrKeys['`' + arrTables[currIndex][fieldName] + '`']['`' + results[i].Key_name + '`'] = [];
                                }
                                arrKeys['`' + arrTables[currIndex][fieldName] + '`']['`' + results[i].Key_name + '`'][(results[i].Seq_in_index) - 1] = ['`' + results[i].Column_name + '`' + (results[i].Sub_part == null ? '' : '(' + results[i].Sub_part + ')')];
                                //arrKeys.push({ key: '`' + results[i].Key_name + '`', tableName: '`' + arrTables[currIndex][fieldName] + '`', isNonUnique: results[i].Non_unique, column: '`' + results[i].Column_name + '`' + (results[i].Sub_part == null ? '' : '(' + results[i].Sub_part + ')') });
                            }
                        }
                    }
                    setTimeout(function () {
                        getKeys(arrTables, fieldName, arrKeys, currIndex + 1, count, json, ignoreTablesStr, arrIgnoreTables, clinet);
                    }, 10);
                }
            });
        }
        else {
            setTimeout(function () {
                getKeys(arrTables, fieldName, arrKeys, currIndex + 1, count, json, ignoreTablesStr, arrIgnoreTables, clinet);
            }, 10);
        }
    }
    else {
        var dropIndexQueries = [];
        var createIndexQueries = [];
        var arrTables = Object.keys(arrKeys);
        
        for (var i = 0; i < arrTables.length; i++) {
            var arrIndexes = Object.keys(arrKeys[arrTables[i]]);
            for (var j = 0; j < arrIndexes.length; j++) {
                dropIndexQueries.push('DROP INDEX ' + arrIndexes[j] + ' ON ' + arrTables[i] + ';');
                createIndexQueries.push('ALTER TABLE ' + arrTables[i] + ' ADD ' + ' INDEX ' + arrIndexes[j] + ' (' + arrKeys[arrTables[i]][arrIndexes[j]].join(',') + ') ;');
                //createIndexQueries.push('ALTER TABLE ' + arrKeys[i].tableName + ' ADD ' + (arrKeys[i].isNonUnique == 0 ? 'UNIQUE' : '') + ' INDEX ' + arrKeys[i].key + ' (' + arrKeys[i].column + ') ;');
            }
        }
        fs.writeFile(json.target_path + "/" + json.dbName + "_" + json.fileTS + "_DROP_INDEX.sql", dropIndexQueries.join('\n'));
        fs.writeFile(json.target_path + "/" + json.dbName + "_" + json.fileTS + "_CREATE_INDEX.sql", createIndexQueries.join('\n'));
        
        var str = "{ ";
        
        if (parseInt(json.takeProcedure) == 1)
            str += "mysqldump --comments --triggers --routines --no-data -h " + json.host + " -u " + json.userName + " -p" + json.password + " " + ignoreTablesStr + " " + json.dbName + "; ";
        else
            str += "mysqldump --comments --no-data -h " + json.host + " -u " + json.userName + " -p" + json.password + " " + ignoreTablesStr + " " + json.dbName + "; ";
        
        str += "cat " + json.target_path + "/" + json.dbName + "_" + json.fileTS + "_DROP_INDEX.sql; ";
        str += "mysqldump --extended-insert --disable-keys --flush-logs --no-autocommit --no-create-info -h " + json.host + " -u " + json.userName + " -p" + json.password + " " + ignoreTablesStr + " " + json.dbName + "; ";
        str += "cat " + json.target_path + "/" + json.dbName + "_" + json.fileTS + "_CREATE_INDEX.sql; ";
        str += "}";

        //str += " | bzip2 > " + json.target_path + "/" + json.fileName + ".bz2";
        //str += " > " + json.target_path + "/" + json.fileName;
        str += " | lz4c -4f  - " + json.target_path + "/" + json.fileName + ".lz4";


        // console.log(str);
        var sys = require('sys')
        var exec = require('child_process').exec;
        function puts(error, stdout, stderr) {
            // console.log("done");
            process.exit();
            //   process.send("test");

        }
        exec(str, puts);

        //res.send('Done...');
    }
}
