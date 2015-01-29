
function EntityManager() {

    var cache = {
        findAll : {}
    };
    
    this.findAll = function(Class, callback) {
        return Class.query(callback);
    };

    this.find = function(Class, query) {
        
    };

}
