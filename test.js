


    var   config    = require('./config.js')
        , Related   = require('related')
        , log       = require('ee-log')
        , Extension = require('./')
        , related   = new Related(config.db);


    related.use(new Extension());


    related.load().then(function(related) {
        var db = related.related_restrictions_test;


        db.venue('*').fetchEvent('*')
        .restrict({
            'event.id_tenant': [{
                  type: 'constant'
                , operator: 'equal'
                , value: 1
                , nullable: true
            }]
        }).find().then(function(venues) {

            if (venues.some(function(venue) {
                return venue.event.some(function(evt) {
                    return evt.id_tenant !== 1 && evt.id_tenant !== null;
                });
            })) {
                throw new Error('invalid tenant id!');
            }

        }).catch(log);
    }).catch(log);