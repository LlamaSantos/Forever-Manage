#!/usr/bin/env node
var fs = require("fs"),
    path = require("path"),
    nconf = require("nconf"),
    forever = require("forever-monitor"),
    flatiron  = require("flatiron"),
    app = flatiron.app,
    EventEmitter2 = require("EventEmitter2").EventEmitter2,
    bus = new EventEmitter2({
        delimeter: "::",
        wildcards: true
    });

app.use(flatiron.plugins.cli, {});
app.use(flatiron.plugins.log, {});

var children = [];

bus.on("app::config", function (){

    var $file = path.normalize(path.join(process.env.HOME, ".foreverconfig"));
    var exists = fs.existsSync($file);
    if (!exists){
        var data = fs.readFileSync("./base.json", "utf-8");
        fs.writeFileSync($file, data, "utf-8");

    }
    nconf.argv().env().file({file: $file});
});
bus.on("app::start", function (){
    var projects = nconf.get("projects");
    _(_.keys(projects)).each(function (name){
        child.push(new (forever.Monitor)(projects[name], {
            silent: false,
            watch: true,
            watchIgnoreDotFiles: true,
            watchIgnorePatterns: true,
            spawnWith: {
                env: process.ENV,
                customFds: [-1,-1,-1],
                setsid: false
            },
            env: {
                environment: "dev"
            }
        }));
    });
});
// -- Ensure we can do anything w/ a config file.
bus.emit("app::config");

//"add :name :path"
app.router.on("add :name :module", function (name, _path){
    var $file = path.normalize(path.join(process.cwd(), _path));
    app.log.info("Adding " + name + " at: " + $file);

    if (fs.existsSync(path.normalize(path.join(process.cwd(), "package.json")))){
        app.log.info($file);
        var projects = nconf.get("projects");
        projects[name] = $file;
        nconf.set("projects", projects);
        nconf.save(function (err){
            if (err){
                app.log.error(err);
            }
            else{
                app.log.info("Project Successfully Added.");
            }
        });
    }
    else{
        throw "No package can be found at: " + $file;
    }

});

app.router.on("start", function (){
    bus.emit("app::start");
});

// -- Dispatch everything from the cmdline
app.router.dispatch("on", process.argv.slice(2).join(' '));