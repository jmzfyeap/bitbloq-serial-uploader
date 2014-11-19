/* *******************************************************
 * bitbloq Serial Uploader
 * bitbloqSU.Serial - Chrome.serial communication functionality
 ********************************************************* */
'use strict';
/* global logger, Promise, bitbloqSU*/
bitbloqSU.Serial = (function() {
    bitbloqSU.SerialAPI = window.chrome.serial;
    bitbloqSU.disconnectTimer = null;
    bitbloqSU.lineBuffer = 0;
    var deviceInfo = {
        port: undefined,
        connected: false,
        connectionId: -1,
        boardInfo: undefined
    };
    if (window.bitbloqSU.availableBoards) {
        var _boardList = window.bitbloqSU.availableBoards;
    } else {
        throw 'Board configurations not available';
    }
    var receiverListener = undefined;
    var defaultOnReceiveDataCallback = function(done) {
        return function(evt) {
            logger.info('bitbloqSU.callback');
            var str;
            (evt.data.byteLength === 2) ? str = String.fromCharCode.apply(null, new Uint16Array(evt.data)) : str = String.fromCharCode.apply(null, new Uint8Array(evt.data));
            var responseCode = parseInt(str.charCodeAt(0).toString(16), 10);
            logger.info({
                'SerialAPI.onReceive': responseCode
            });
            if (evt.data.byteLength != 0) {
                logger.warn({
                    'evt.data.byteLength': evt.data.byteLength
                });
                bitbloqSU.lineBuffer += evt.data.byteLength;
                logger.info({
                    'lineBuffer': bitbloqSU.lineBuffer
                });
                if (bitbloqSU.lineBuffer >= 2) {
                    logger.info('lineBuffer >= 2');
                    if (bitbloqSU.lineBuffer) {
                        bitbloqSU.lineBuffer = 0;
                        logger.warn('bitbloqSU.lineBuffer set to 0');
                        removeReceiveDataListener();
                        logger.info('bitbloqSU.SerialAPI.onReceive.addListener removed');
                        done();
                    }
                } else if (bitbloqSU.lineBuffer >= 4) {
                    logger.info('lineBuffer >= 4');
                    if (bitbloqSU.lineBuffer) {
                        bitbloqSU.lineBuffer = 0;
                        logger.warn('bitbloqSU.lineBuffer set to 0');
                        removeReceiveDataListener();
                        logger.info('bitbloqSU.SerialAPI.onReceive.addListener removed');
                        done();
                    }
                }
            } else {
                logger.error('Data receive byteLength === 0');
            }
        };
    };
    var addReceiveDataListener = function(callback) {
        logger.info('bitbloqSU.addReceiveDataListener');
        receiverListener = callback;
    };
    var removeReceiveDataListener = function() {
        logger.info('bitbloqSU.removeReceiveDataListener');
        receiverListener = undefined;
    };
    var init = function() {
        logger.info('bitbloqSU.init');
        bitbloqSU.SerialAPI.onReceive.addListener(function(evt) {
            if (receiverListener) {
                receiverListener.call(this, evt);
            }
        });
        bitbloqSU.SerialAPI.onReceiveError.addListener(function(event) {
            logger.error(event);
            disconnectTimerFunc(1000);
        });

        bitbloqSU.SerialAPI.onReceiveError.addListener(function(evt) {
            logger.error(evt);
        });

    };
    var getDevicesList = function(callback) {
        try {
            bitbloqSU.SerialAPI.getDevices(function(devices) {
                for (var i = 0; i < devices.length; i++) {
                    var info = devices[i];
                    if (setDeviceInfo(info)) {
                        logger.info('Board detected -> ', deviceInfo);
                        callback(true);
                        return true;
                    }
                }
                callback(false);
            });
        } catch (e) {
            logger.error(e);
        }
    };
    var getDeviceInfo = function() {
        return deviceInfo;
    };
    var setDeviceInfo = function(config) {
        if (!config) {
            deviceInfo.port = undefined;
            deviceInfo.connected = false;
            deviceInfo.connectionId = -1;
            deviceInfo.boardInfo = null;
            return false;
        }
        for (var i = 0; i < _boardList.length; i++) {
            var item = _boardList[i];
            if (item.id === config.displayName) {
                deviceInfo.boardInfo = item;
                deviceInfo.port = config.path;
                deviceInfo.connected = true;
                return true;
            }
        }
        return false;
    };
    var getConnections = function() {
        return new Promise(function(resolve) {
            bitbloqSU.SerialAPI.getConnections(function(connections) {
                resolve(connections);
            });
        });
    };
    var disconnect = function() {
        getConnections().then(function(connections) {
            if (connections.length > 0) {
                bitbloqSU.SerialAPI.disconnect(deviceInfo.connectionId, function() {
                    deviceInfo.connectionId = -1;
                    deviceInfo.connected = false;
                    logger.info('Port disconnected!');
                }); // Close port
            }
        });
    };
    var connect = function() {
        return new Promise(function(resolve, reject) {
            if (deviceInfo.connected) {
                try {
                    logger.info('Connecting to board...');
                    bitbloqSU.SerialAPI.connect(deviceInfo.port, {
                        bitrate: deviceInfo.boardInfo.bitrate,
                        sendTimeout: 2000,
                        receiveTimeout: 2000,
                        //ctsFlowControl: true,
                        name: 'bitbloqSerialConnection'
                    }, function(info) {
                        if (info.connectionId !== -1) {
                            deviceInfo.connectionId = info.connectionId;
                            deviceInfo.connected = true;
                            logger.info({
                                'Connection board TEST OK': info
                            });
                            resolve();
                        } else {
                            deviceInfo.connected = false;
                            deviceInfo.connectionId = -1;
                            logger.error({
                                'Connection board TEST KO': 'KO'
                            });
                            reject();
                        }
                    });
                } catch (e) {
                    deviceInfo.connectionId = -1;
                    deviceInfo.connected = false;
                    deviceInfo.boardInfo = null;
                    logger.error({
                        'Connection board TEST KO': e
                    });
                    reject(e);
                }
            } else {
                reject();
            }
        });
    };
    var disconnectTimerFunc = function(time) {
        //Disconnect before 10 seconds by safety
        logger.warn({
            'Disconnecting board in [ms] ': time
        })
        if (!bitbloqSU.disconnectTimer) {
            bitbloqSU.disconnectTimer = setTimeout(function() {
                bitbloqSU.Serial.disconnect();
                clearTimeout(bitbloqSU.disconnectTimer);
                bitbloqSU.disconnectTimer = null;
            }, time);
        }
    };
    var autoConfig = function() {
        return new Promise(function(resolve, reject) {
            logger.info('Detecting boards....');
            getDevicesList(function(statusOk) {
                if (statusOk) {
                    connect().then(function() {
                        resolve();
                    }).
                    catch(function() {
                        setDeviceInfo(null);
                        reject();
                    });
                }
                if (!deviceInfo.port || !statusOk) {
                    setDeviceInfo(null);
                    reject();
                    logger.error('None board detected!');
                }
            });
        });
    };
    /*
    infoObject = {
        dtr: false,
        rts: false
    }
     */
    var setControlSignals = function(infoObject) {
        return new Promise(function(resolve) {
            bitbloqSU.SerialAPI.setControlSignals(deviceInfo.connectionId, infoObject, function() {
                setTimeout(function() {
                    resolve();
                }, bitbloqSU.Serial.getDeviceInfo().boardInfo.delay_reset);
            });
        });
    };
    var onReceiveCallback = function() {
        return true;
    };
    var sendData = function(data) {
        logger.info({
            'bitbloqSU.sendData': data
        });

        return new Promise(function(resolveSendData, rejectSendData) {
            logger.info('Chrome is writing on board...');
            if (deviceInfo.connected) {
                var onReceivePromise = new Promise(function(resolveOnReceive, rejectOnReceive) {
                    bitbloqSU.Serial.addReceiveDataListener(defaultOnReceiveDataCallback(resolveOnReceive));
                });

                bitbloqSU.SerialAPI.send(deviceInfo.connectionId, data, function(sendInfo) {
                    logger.info({
                        'sendInfo': sendInfo
                    });
                    onReceivePromise.then(function() {
                        resolveSendData();
                    }).catch(function() {
                        rejectSendData();
                    });
                });
            } else {
                logger.error('device is not connected');
                rejectSendData();
            }
        });
    };
    return {
        init: init,
        setControlSignals: setControlSignals,
        autoConfig: autoConfig,
        getDeviceInfo: getDeviceInfo,
        sendData: sendData,
        connect: connect,
        disconnect: disconnect,
        receiverListener: receiverListener,
        defaultOnReceiveDataCallback: defaultOnReceiveDataCallback,
        addReceiveDataListener: addReceiveDataListener,
        removeReceiveDataListener: removeReceiveDataListener
    };

})();