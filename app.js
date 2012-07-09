#!/usr/bin/env node
var fs = require("fs")
    path = require("path"),
    nconf = require("nconf"),
    forever = require("forever-monitor"),
    _ = require("underscore"),
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
    nconf.use("file", {file: $file});
});
bus.on("app::start", function (){
    var projects = nconf.get("projects");
    _(_.keys(projects)).each(function (name){
        var child = new (forever.Monitor)(projects[name], {
            silent: false,
            watch: true,
            watchDirectory: path.dirname(projects[name]),
            watchIgnoreDotFiles: true,
            watchIgnorePatterns: true
        });

        child.on("start", function (){
            app.log.info("Process " + name + " has started.");
        });
        child.on("error", function (err){
            app.log.error(err);
        });
        child.on("exit", function (){
            app.log.info("Process " + name + " has exited.");
        });

        child.start();
    });
});
// -- Ensure we can do anything w/ a config file.
bus.emit("app::config");

//"add :name :path"
app.router.on("add :name :module", function (name, _path){
    var basePath = path.normalize(path.join(process.cwd(), _path));
    app.log.info("Adding " + name + " at: " + basePath);

    app.log.info(process.cwd());

    var packageJson = path.normalize(path.join(basePath, "package.json"));
    if (fs.existsSync(packageJson)){
        var pkg = JSON.parse(fs.readFileSync(packageJson));
        var file = path.normalize(path.join(basePath, (pkg.main || "app.js")));
        if (fs.existsSync(file)){
            var projects = nconf.get("projects");
            projects[name] = file;
            nconf.set("projects", projects);
            nconf.save(function (err){
                if (err){
                    app.log.error(err);
                }
                else{
                    app.log.info("Project successfully added.");
                }
            });
        }
        else{
            throw "Cannot determine an application entry point, define a 'main' in package.json.";
        }
    }
    else{
        throw "No package can be found at: " + basePath;
    }

});

app.router.on("remove :name", function (name){
    var projects = nconf.get("projects");
    app.log.info("Removing " + name + " at: " + (projects[name] || "not found"));
    delete projects[name];
    nconf.set("projects", projects);
    nconf.save(function (err){
        if (err) app.log.error(err);
        else app.log.info("Project successfully removed.");
    })
});

app.router.on("start", function (){
    bus.emit("app::start");
});

// -- Dispatch everything from the cmdline
app.router.dispatch("on", process.argv.slice(2).join(' '));
