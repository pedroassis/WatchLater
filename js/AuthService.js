
function AuthService($appbase) {
    var providers = ['Facebook', 'LinkedIn', 'GitHub', 'Dropbox', 'Google'];

    this.getProviders = function() {
        return providers;
    };

    this.getUser = function() {
        return $appbase.getAuth();
    };

    this.authenticate = function(provider) {
        var defer = $.defer();

        $appbase.authPopup(provider, function(error, authObj, requestObj) {
            if(error) {
                defer.reject(error);
            } else {
                defer.resolve(authObj);
            }
        });

        return defer.promise;
    };

}
