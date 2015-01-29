
function ListController(Movies, notFoundUrl, AuthService, $mdToast, $appbase) {

    this.title = '';
    
    this.movies = [];
    
    this.userMovies = [];

    var lastSearch = [];

    var authObj = AuthService.getUser();

    this.user = authObj && authObj.authObj ? authObj.authObj : null;

    this.changeTab = function(index) {
        this.tab = index;

        this.movies = index === 1 ? this.userMovies : lastSearch;
    };

    this.loginPopup = function() {
        $appbase.authPopup('google', {
            authorize: {
                    scope: ['openid']
                }
            }, (function(error, authObj, requestObj) {
            if(error) {
                showToast('Could not login.')
            } else {
                showToast('Welcome ' + authObj.firstname + '!');
                this.user = authObj;
            }
        }).bind(this));
    };

    this.logOff = function() {
        $appbase.unauth();

        delete this.user;
    };

    this.toggleMovie = function(movie) {
        var index = this.userMovies.indexOf(movie);
        if(index === -1){
            this.userMovies.push(movie);
        } else {
            this.userMovies.splice(index, 1);
        }
    };

    this.toWatch = function(movie) {
        return this.userMovies.indexOf(movie) !== -1;
    };

    this.search = function() {
        Movies.search({
            text : this.title,
            properties : ['title']
        }, function(err, search) {
            if(err){
                return showToast("Verify your connection");
            }
            lastSearch = search;
            this.movies = search;
        }.bind(this));
    };

    this.getPoster = function(url) {
        return url && url !== 'N/A' ? url : notFoundUrl;
    };

    function showToast(message){
        $mdToast.show(
            $mdToast.simple()
            .content(message)
        );
    }

}

