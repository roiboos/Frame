var weather = require('openweather-apis');
var http = require('http');
const fs = require('fs');
var moment = require('moment');
var WebSocket = require('ws');
var host = '192.168.178.49';
var port = 443;
var admin = require("firebase-admin");
var serviceAccount = require("./serviceAccountKey.json");
const express = require('express');

var ws;
var intervalObj;

function initOpenWeatherMap() {
    weather.setAPPID('762ba7a272a0aeb54620825407f3c259');
    weather.setCityId(2823682);
    weather.setUnits('metric');
}

function connect() {
    ws = new WebSocket('ws://' + host + ':' + port);
    ws.onopen = function () {
        log.info('Connected');
    };

    ws.onclose = function (e) {
        log.info('Socket is closed. Reconnect will be attempted in 5 seconds.', e.reason);
        setTimeout(function () {
            connect();
        }, 5000);
    };

    ws.onmessage = function (msg) {
        payload = JSON.parse(msg.data);
        if (payload.e == 'changed' && payload.r == 'sensors') {
            var sensorid = payload.id;
            if (payload.state != null && payload.state.lastupdated != null) {
                var lastupdated = payload.state.lastupdated;
                if (payload.state.open != null) {
                    var open = payload.state.open;
                    log.info('Submitting ' + sensorid + ' ' + lastupdated + ' ' + open);
                    submitSensorChange(sensorid, lastupdated, 'open', open);
                }
            }
        };
    }

    intervalObj = setInterval(() => {
        sendHeartbeat();
        const now = moment();
        if (now.hour() >=  6) {
            refresh();
        }
    }, 30 * 60 * 1000);
}

function submitSensorChange(sensorId, lastupdated, attribute, value) {
    log.info(sensorId, value);
    let data = require('./data.json');
    const sensor = data.windows.sensors.find(x => x.id === sensorId);
    sensor.open = value;
    log.info('Floor ', sensor.location);
    const sensors = data.windows.sensors.filter(x => x.location === sensor.location);
    const open = sensors.reduce((sum, next) => sum || next.open, false);
    if (sensor.location === 'eg') {
        data.windows.eg = open;
    }
    else {
        data.windows.og = open;
    }
    let dataString = JSON.stringify(data);
    fs.writeFileSync('data.json', dataString);
}

function refresh() {
    const now = moment();
    let data = require('./data.json');
    data.today.dayofweek = getWeekDayName(now.isoWeekday());
    data.today.day = `${now.date()}`;
    data.today.year = `${now.year()}`;
    data.today.month = getMonthName(now.month());
    data.calendar.first = moment().startOf('month').isoWeekday();
    data.calendar.days = now.daysInMonth();

    let garbage = require('./garbage.json');
    const rest = garbage.rest
        .map(x => moment(x))
        .filter(x => !x.isBefore(now.startOf('day')));
    const nextRest = rest && rest[0];
    const diffRest = moment.duration(nextRest.diff(now.startOf()));
    data.garbage.rest = getNotificationText(diffRest.asDays());

    const papier = garbage.papier
        .map(x => moment(x))
        .filter(x => !x.isBefore(now.startOf('day')));
    const nextPapier = papier && papier[0];
    const diffPapier = moment.duration(nextPapier.diff(now.startOf()));
    data.garbage.papier = getNotificationText(diffPapier.asDays());

    weather.getWeatherForecast(function (err, obj) {
        obj.list.filter(element => {
            const ts = moment.utc(element.dt, "X");
            return (ts.date() === now.date() || ts.date() === now.date() + 1) && ts.month() === now.month();
        }).forEach(element => {
            const ts = moment.utc(element.dt, "X");
            if (ts.hour() === 18 && ts.date() === now.date()) {
                data.weather.evening.temperature = `${element.main.temp.toFixed(1)}°C`
            }
            if (ts.hour() === 3 && ts.date() === now.date() + 1) {
                data.weather.night.temperature = `${element.main.temp.toFixed(1)}°C`
            }
            if (ts.hour() === 9 && ts.date() === now.date()) {
                data.weather.morning.temperature = `${element.main.temp.toFixed(1)}°C`
            }
            if (ts.hour() === 12 && ts.date() === now.date()) {
                data.weather.afternoon.temperature = `${element.main.temp.toFixed(1)}°C`
            }
        });

        weather.getTemperature(function (err, temp) {
            data.weather.current.temperature = `${temp.toFixed(1)}°C`;
            let dataString = JSON.stringify(data);
            fs.writeFileSync('data.json', dataString);
        });
    });
}

function getMonthName(month) {
    switch (month) {
        case 0:
            return 'Januar';
        case 1:
            return 'Februar';
        case 2:
            return 'März';
        case 3:
            return 'April';
        case 4:
            return 'Mai';
        case 5:
            return 'Juni';
        case 6:
            return 'Juli';
        case 7:
            return 'August';
        case 8:
            return 'September';
        case 9:
            return 'Oktober';
        case 10:
            return 'November';
        case 11:
            return 'Dezember';
        default:
            return 'Nix';
    }
}

function getWeekDayName(weekday) {
    switch (weekday) {
        case 1:
            return 'Montag';
        case 2:
            return 'Dienstag';
        case 3:
            return 'Mittwoch';
        case 4:
            return 'Donnerstag';
        case 5:
            return 'Freitag';
        case 6:
            return 'Samstag';
        case 7:
            return 'Sonntag'
        default:
            return 'Nix';
    }
}

function getNotificationText(days) {
    if (days === 1)
        return 'MORGEN';
    else if (days === 0)
        return 'HEUTE';
    else return '';
}

function sendHeartbeat() {
    log.info("Sending heartbeat");
    var database = admin.database();
    var gatewayRef = database.ref('frame');
    var heartbeat = new Date().toISOString();
    gatewayRef.set({ heartbeat: heartbeat });
}

function sendFileContent(file, res) {
    fs.readFile(file, "utf8", function (err, data) {
        if (err) throw err;
        var logs = data.toString().replace(new RegExp('\n', 'g'), '<br>');
        res.send(logs);
    });
}

// create a custom timestamp format for log statements
const SimpleNodeLogger = require('simple-node-logger'),
    opts = {
        logFilePath: 'framejs.log',
        timestampFormat: 'YYYY-MM-DD HH:mm:ss',
    },
    log = SimpleNodeLogger.createSimpleLogger(opts);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://myhub-e496a.firebaseio.com"
});

const app = express();
app.get('/logs/js', (req, res) => {
    sendFileContent("framejs.log", res);
});
app.get('/logs/py', (req, res) => {
    sendFileContent("framepy.log", res);
});
app.get('/data', (req, res) => {
    sendFileContent("data.json", res);
});
app.listen(3000);

initOpenWeatherMap();
refresh();
connect();
sendHeartbeat();
