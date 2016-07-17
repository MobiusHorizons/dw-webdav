/*
 * module dw-webdav
 */
'use strict';

var 
  fs        = require('fs'),
  path      = require('path'),
  progress  = require('progress-stream'),
  request   = require('request'),
  stream    = require('stream'),
  url       = require('url'),
  XmlStream = require('xml-stream')
;

class DWServer {
  constructor(host, username, password){
    this.auth_info = {
      'user' : username,
      'pass' : password
    }
    this.host = host;
    this.remoteBase = "https://" + host + "/on/demandware.servlet/webdav/Sites/Cartridges/"; 
  }

  auth(){
    return new Promise((resolve, reject) => {
      request.get({
        url  : this.remoteBase,
        auth : this.auth_info,
      }, function(error, response, body){
        if (error != null){
          reject(error);
          return;
        }
        if (response.statusCode == 401){
          reject('Unauthorized');
          return;
        }
        resolve('Authorized');
      });
    });
  }

  upload(local_path, remote_path, reportProgress){
    if (typeof remote_path == 'string'){
      remote_path = url.resolve(this.remoteBase,remote_path);
    } else {
      reportProgress = remote_path;
      remote_path = url.resolve(this.remoteBase,local_path);
    }

    return new Promise((resolve, reject) => {
      var stats = fs.statSync(local_path)
      fs.createReadStream(local_path)
        .pipe(progress({length : stats.size}, reportProgress)) 
        .pipe(request.put(remote_path, {auth : this.auth_info}))
        .on('end', () => {
          resolve('upload', local_path);
        })
        .on('error', (error) => {
          reject(error);
        })
    });
  }

  upload_stream(remote_path, reportProgress){
    remote_path = url.resolve(this.remoteBase,remote_path);
      var progress_stream = progress(reportProgress);

      return progress_stream
      .pipe(request.put(remote_path, {auth : this.auth_info}));
  }

  delete(remote_path){
    remote_path = url.resolve(this.remoteBase,remote_path);
    return new Promise((resolve, reject) => {
      request.delete({
        url    : remote_path,
        auth   : this.auth_info,
      }).on('error', (error) => {
        reject(error);
      })
      .on('end', () => {
        resolve();
      });
    })
  }

  unzip(remote_path){
    remote_path = url.resolve(this.remoteBase,remote_path);
    return new Promise((resolve, reject) => {
      request.post({
        form : {
          method: 'UNZIP' 
        },
        url    : remote_path,
        auth   : this.auth_info,
      })
      .on('error', reject)
      .on('end', resolve);
    })
  }

  get_stream(remote_path, options){
    remote_path = url.resolve(this.remoteBase,remote_path);
    options.url = remote_path;
    options.auth = this.auth_info;
    return request.get(options, options.cb);
  }

  ls(remote_path){
    remote_path = url.resolve(this.remoteBase, remote_path);
    return new Promise((resolve, reject) => {
      let propstat = request({
        method : 'PROPFIND',
        url    : remote_path,
        auth   : this.auth_info,
      })

      let entries = [];
      let xml = new XmlStream(propstat)
      xml.on('endElement: response', entry => {
        entries.push(entry)
      })
      xml.on('end', () => {
        resolve(entries);
      })
      xml.on('error', (error) => {
        reject(error)
      })
    })
  }

  mkdir(remote_path){
    remote_path = url.resolve(this.remoteBase,remote_path);
    return new Promise((resolve, reject) => {
      request({
        method : 'MKCOL',
        url    : remote_path,
        auth   : this.auth_info,
      })
      .on('error', reject)
      .on('end', resolve);
    })
  }
}

module.exports = DWServer;
