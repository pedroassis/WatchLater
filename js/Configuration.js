
var toWatchApp = angular.module('ToWatch', ['ngAnimate', 'ngMaterial', 'ngResource', 'ngAppbase']);

toWatchApp.constant('notFoundUrl', '/images/not-found.png');

toWatchApp.controller('ListController', ListController);

toWatchApp.service('AuthService', AuthService);

toWatchApp.service('Movies', function($appbase) {
    return $appbase.ns("Movies");
});

toWatchApp.run(function($appbase, Movies, $http) {
    $appbase.credentials("watchlist", "85bf32de5f631d0f6115cf391b87f8d5");


    // $http.get('/js/movies.json').then(function(response) {

    //     response.data.forEach(function(item) {
    //         var movieRef = Movies.v(item.idIMDB);
    //         movieRef.setData(item);
    //     });
    // });
});


