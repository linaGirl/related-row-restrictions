


    var   config    = require('./config.js')
        , Related   = require('related')
        , log       = require('ee-log')
        , Extension = require('./')
        , related   = new Related(config.db);


    related.use(new Extension());


    related.load().then(function(related) {
        var db = related.related_restrictions_test;


        var restricitonSet = {
            get: function(entityName) {

                if (entityName === 'venue') {
                    return [{
                          type: 'constant'
                        , column: 'id_tenant'
                        , path: ['event']
                        , fullPath: 'event.id_tenant'
                        , operator: 'equal'
                        , value: 1
                        , nullable: false
                        , global: false
                    }];
                } 
                else return [];
            }


            , getGlobal: function() {
                return [{
                          type: 'constant'
                        , column: 'id_tenant'
                        , path: null
                        , fullPath: 'id_tenant'
                        , operator: 'equal'
                        , value: 2
                        , nullable: false
                        , global: true
                    }];
            }
        };


        db.venue('*').fetchEvent('*').setRestrictions(restricitonSet).find().then(function(venues) { 
            log(venues.length);
        }).catch(log);
    }).catch(log);