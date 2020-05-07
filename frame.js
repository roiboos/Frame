var weather = require('openweather-apis');
var http = require('http');
const fs = require('fs');
var moment = require('moment');
var WebSocket = require('ws');
var host = '192.168.178.49';
var port = 443;

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
        console.log('Connected');
    };

    ws.onclose = function (e) {
        console.log('Socket is closed. Reconnect will be attempted in 5 seconds.', e.reason);
        setTimeout(function () {
            connect();
        }, 5000);
    };

    ws.onmessage = function (msg) {
        payload = JSON.parse(msg.data);
        console.log(payload);
        if (payload.e == 'changed' && payload.r == 'sensors') {
            var sensorid = payload.id;
            if (payload.state != null && payload.state.lastupdated != null) {
                var lastupdated = payload.state.lastupdated;
                if (payload.state.open != null) {
                    var open = payload.state.open;
                    console.log('Submitting' + sensorid + ' ' + lastupdated + ' ' + open);
                    submitSensorChange(sensorid, lastupdated, 'open', open);
                }
            }
        };
    }

    intervalObj = setInterval(() => {
        const now = moment();
        if (now.hour() > 6) {
            refresh();
        }
    }, 5 * 60 * 1000);
}

function submitSensorChange(sensorId, lastupdated, attribute, value) {
    console.log(sensorId, value);
    let data = require('./data.json');
    const sensor = data.windows.sensors.find(x => x.id === sensorId);
    sensor.open = value;
    console.log('Floor', sensor.location);
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
    console.log('Day', now.date());
    console.log('Month', now.month());
    console.log('Year', now.year());
    console.log('DayOfWeek', now.isoWeekday());
    console.log('Days', now.daysInMonth());

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
    data.garbage.rest = getNotificationText(diffRest.days());

    const papier = garbage.papier
        .map(x => moment(x))
        .filter(x => !x.isBefore(now.startOf('day')));
    const nextPapier = papier && papier[0];
    const diffPapier = moment.duration(nextPapier.diff(now.startOf()));
    data.garbage.papier = getNotificationText(diffPapier.days());

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
            console.log(temp);
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

initOpenWeatherMap();
refresh();
connect();
