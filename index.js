const lineReader = require('line-reader');
const fileName = 'input_data/a_example.txt';

lineReader.eachLine(fileName, function(line, last) {
    console.log(line);
});