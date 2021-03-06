/* ***************************
 * bitbloq Serial Uploader
 * Available Boards list
 ***************************** */

'use strict';
/* exported window.bitbloqSU */


//List of available boards configurations
window.bitbloqSU.availableBoards = [
    //Freaduino Uno
    {
        id: 'Arduino_Uno',
        name: 'Arduino Uno',
        arch: 'arduino',
        board: 'uno',
        bitrate: 115200,
        maxPageSize: 128,
        delay_reset: 50,
        delay_send:20,
        max_size: 32256
    },
    //bq ZUM
    {
        id: 'FT232R_USB_UART',
        name: 'ZUM BT',
        arch: 'arduino',
        board: 'bt328',
        bitrate: 19200,
        maxPageSize: 128,
        delay_reset: 100,
        delay_send:0,
        max_size: 28672
    }
];
