var fs = require("fs");

var inStream = fs.createReadStream("base.json", { encoding: "utf-8" });

var outStream = fs.createWriteStream("temp.json", { encoding: "utf-8" });

inStream.pipe(outStream);