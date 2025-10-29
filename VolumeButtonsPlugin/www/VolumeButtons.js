var exec = require('cordova/exec');

var VolumeButtons = {
    onVolumeUp: function(callback) {
        document.addEventListener('volumeup', callback, false);
    },
    onVolumeDown: function(callback) {
        document.addEventListener('volumedown', callback, false);
    },
    _fireEvent: function(type) {
        var event = new Event(type);
        document.dispatchEvent(event);
    }
};

module.exports = VolumeButtons;

