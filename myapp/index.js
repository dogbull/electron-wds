'use strict';

const fs = require('fs');
const { remote } = require('electron');
let iconv = require('iconv-lite');
const dialog  = remote.dialog;
const win = remote.getCurrentWindow();

$('.datepicker').datepicker({
    autoclose: true,
    format: 'yyyy-mm-dd',
}).datepicker("setDate", new Date());

$('#btnDownload').click(async function(e){
    let region_eng = 'jeju';
    let begin = moment($('#startDate').val()).format('YYYYMMDD');
    let end = moment($('#endDate').val()).format('YYYYMMDD');
    let points = {};

    let $points = $('#points');
    let ps = $points.val();
    let lines = ps.split('\n');
    let lonlats = [];
    let addresses = [];
    for(let i=0; i<lines.length; ++i){
        let line = lines[i];

        let separator = ',';
        let s = line.split(separator);

        if (s.length === 2) {
            let forward = false;
            let resp = await geocode(forward, s);
            
            let pr = processGeocodeResponse(forward, resp);
            lonlats.push([pr.location.lng, pr.location.lat]);
            addresses.push(pr.address);
            console.log(pr);
        } else {
            let forward = true;
            let resp = await geocode(forward, line);

            let pr = processGeocodeResponse(forward, resp);
            lonlats.push([pr.location.lng, pr.location.lat]);
            addresses.push(pr.address);
            console.log(pr);
        }
    }
    points.lonlats = lonlats;
    points.addresses  = addresses;

    if (points.length == 0){
        return alert('경위도를 입력하세요.');
        return;
    }

    dialog.showSaveDialog(win, {
        filters: [
            {name: 'csv', extensions: ['csv']}
        ],
    }).then(result => {
        if( result.canceled ){
            return;
        }
        let filepath = result.filePath;

        download(region_eng, begin, end, points, filepath, function(data){
            data = iconv.encode(data, 'euc-kr');
            try {
                fs.writeFileSync(filepath, data, {encoding: 'binary'});
                alert(filepath);
            }catch(e){
                alert('Failed to save the file !');
            }
        });
    });

});

function download(region, begin, end, points, filepath, callback){
    let items_str = 'estimation:tmin,estimation:tmax,estimation:hm,estimation:rain,estimation:ins,estimation:sunshine,estimation:wsa,estimation:wsx';

    let addresses = points.addresses;
    let lonlats = points.lonlats;
    let lonlats_str = lonlats.map(x=>{return x.join(',')}).join('|');

    let url = `http://${region}.wds2019.agdcm.kr/farm/pickvalue/${items_str}/${begin}:${end}/${lonlats_str}/flatten`;

    console.log(url);

    $.ajax({
        url: url,
        dataType: 'json',
        success: function(data){
            let items = data.header[0];
            let dates = data.header[1];
            let lonlats = data.header[2];

            let csv = ['address', 'lonlat', 'date'].concat(items_str).join(',');
            csv += '\n';

            for(let i=0; i<lonlats.length; ++i){
                let address = addresses[i];
                let lonlatstr = lonlats[i].join(',');
                for(let j=0; j<data.values.length; ++j){
                    let dv = data.values[j];
                    let ndv = dv.map((x)=>{return x[i]});

                    ndv = [`"${address}"`, `"${lonlatstr}"`, dates[j]].concat(ndv);

                    csv += ndv.join(',')
                    csv += '\n';
                }
            }
            callback(csv);
        }
    });
}


function processGeocodeResponse(forward, resp) {
    if (resp.status !== 'OK') {
        alert("Warning: resp.status !== 'OK'");
        return;
    }
    if (resp.results.length === 0) {
        alert("Warning: resp.results.length === 0)");
        return;
    }

    var firstItem = resp.results[0];

    return {
        address: firstItem.formatted_address,
        location: firstItem.geometry.location,
    }
}

function geocode(forward, param) {
    var GOOGLE_API_KEY = 'AIzaSyCb2AwVKp9KcLuDYIMGRJz47oF2iahuA7g';
    var url = null;

    if (forward) {
        url = 'https://maps.googleapis.com/maps/api/geocode/json?language=ko&region=KR&key=' + GOOGLE_API_KEY +
            '&address=' + param
    } else {
        url = 'https://maps.googleapis.com/maps/api/geocode/json?language=ko&region=KR&key=' + GOOGLE_API_KEY +
            '&latlng=' + param[1] + ',' + param[0];
    }

    return new Promise(function(resolve, reject){
        $.ajax({
            url: url,
            dataType: 'json',
            success: function (resp) {
                resolve(resp);
            }
        });
    });
};

String.prototype.format = function () {
    var i = 0, args = arguments;
    return this.replace(/{}/g, function () {
        return typeof args[i] != 'undefined' ? args[i++] : '';
    });
};
