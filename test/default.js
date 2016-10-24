
	process.env.debug_sql = true;


	var   log 			= require('ee-log')
		, assert 		= require('assert')
		, fs 			= require('fs')
		, Related 		= require('related');



	var   RowRestirctions = require('../')
		, sqlStatments
		, extension
		, related
		, db;


	// sql for test db
	sqlStatments = fs.readFileSync(__dirname+'/db.postgres.sql').toString().split(';').map(function(input){
		return input.trim().replace(/\n/gi, ' ').replace(/\s{2,}/g, ' ')
	}).filter(function(item){
		return item.length;
	});



	describe('Travis', function(){
		it('should have set up the test db', function(done){
			var config;

			try {
				config = require('../config.js').db
			} catch(e) {
				config = [{
					  type: 'postgres'
					, schema: 'related_restrictions_test'
					, database: 'test'
					, hosts: [{
						  host 		: 'localhost'
						, username 	: 'postgres'
						, password 	: ''
						, port 		: 5432
					}]
				}];
			}

			this.timeout(5000);
			related = new Related(config);
			related.load(done);
		});


		it('should have set up the test db', function(done) {
			related.related_restrictions_test.event().delete().then(() => {
				return related.related_restrictions_test.venue().delete();
			}).then(() => done()).catch(done);
		});
/*
		it('should be able to drop & create the testing schema ('+sqlStatments.length+' raw SQL queries)', function(done) {
			related.getDatabase('related_restrictions_test').getConnection(function(err, connection) {
				if (err) done(err);
				else {
					Promise.all(sqlStatments.map(function(sql) {
						return new Promise(function(resolve, reject) {
							connection.queryRaw(sql, function(err) {
								if (err) reject(err);
								else resolve();
							});
						});
					})).then(function() {
						done();
					}).catch(done)
				}//async.each(sqlStatments, connection.queryRaw.bind(connection), done);
			});
		});*/
	});


	var getJSON = function(input) {
		if (Array.isArray(input)) return input.map(getJSON);
		else if (typeof input === 'object') {
			var output = input.toJSON ? input.toJSON() : input;
			if (input.children) output.children = getJSON(input.children);
			return output;
		}
		else return input;
	}


	var expect = function(val, cb){
		if (typeof val === 'string') val = JSON.parse(val);

		return function(err, result) { //log(getJSON(result), val, JSON.stringify(result), JSON.stringify(val));
			try {
				assert.deepEqual(getJSON(result), val);
			} catch (err) {
				return cb(err);
			}
			cb();
		}
	};



	describe('The Row Restrictions Extension', function() {
		var oldDate;

		it('should not crash when instatiated', function() {
			db = related.related_restrictions_test;
			extension = new RowRestirctions();
		});


		it('should not crash when injected into the related', function(done) {
			related.use(extension);
			related.reload(done);
		});

		it('setting variable', function() {
			db = related.related_restrictions_test;
		});
	});




	describe('Inserting Test Data', function() {
		it('Random Data', function(done) {

			this.timeout(10000);

			const ids = [];

			Promise.all(Array.apply(null, {length:100}).map(function(item, index) {
				return new db.venue({
					  id_tenant 	: index > 80 ? 1 : index > 50 ? 2 : 3
					, name 		 	: 'event_'+index
					, created 		: index > 80 ? new Date(1983, 9 ,2 ,7 ,30, 0) : new Date(2083, 9 ,2 ,7 ,30, 0)
				}).save().then((venue) => {
					ids.push(venue.id);
					return Promise.resolve();
				});
			})).then(function() {
				return Promise.all(Array.apply(null, {length:100}).map(function(item, idx) {
					return new db.event({
						  name 		: 'event_'+idx
						, id_tenant : idx > 80 ? 1 : idx > 50 ? 2 : null
						, id_venue  : ids[Math.ceil(Math.random()*100)]
					}).save();
				}));
			}).then(function() {
				done();
			}).catch(done);
		});
	});





	describe('Querying', function() {
		it('Filtering by variable', function(done) {

	        var restricitonSet = {
	            get: function(entityName) {

	                if (entityName === 'event') {
	                    return [{
	                          type: 'variable'
	                        , property: 'id_tenant'
	                        , path: null
	                        , fullPath: 'id_tenant'
	                        , comparator: 'equal'
	                        , value: 'tenantId'
	                        , nullable: false
	                        , global: false
	                    }];
	                } else return [];
	            }


	            , getGlobal: function() {
	                return [];
	            }
	        };


			db.event('*')
			.setRestrictionVariable('tenantId', 1)
			.setRestrictions(restricitonSet).find().then(function(events) {
				assert(events.length > 10);

				if (events.some(function(evt) {
					return evt.id_tenant !== 1;
				})) {
					throw new Error('invalid tenant id!');
				}
				done();
			}).catch(done);
		});

		it('Filtering by variable (nullable)', function(done) {
			var restricitonSet = {
	            get: function(entityName) {

	                if (entityName === 'event') {
	                    return [{
	                          type: 'variable'
	                        , property: 'id_tenant'
	                        , path: null
	                        , fullPath: 'id_tenant'
	                        , comparator: 'equal'
	                        , value: 'tenantId'
	                        , nullable: true
	                        , global: false
	                    }];
	                }
	                else return [];
	            }


	            , getGlobal: function() {
	                return [];
	            }
	        };


			db.event('*')
			.setRestrictionVariable('tenantId', 1)
			.setRestrictions(restricitonSet).find().then(function(events) {
				assert(events.length > 30);

				if (events.some(function(evt) {
					return evt.id_tenant !== 1 && evt.id_tenant !== null;
				})) {
					throw new Error('invalid tenant id!');
				}
				done();
			}).catch(done);
		});

		it('Filtering by function', function(done) {
			var restricitonSet = {
	            get: function(entityName) {

	                if (entityName === 'venue') {
	                    return [{
	                          type: 'function'
	                        , property: 'created'
	                        , path: null
	                        , fullPath: 'created'
	                        , comparator: 'lt'
	                        , value: 'now()'
	                        , nullable: false
	                        , global: false
	                    }];
	                }
	                else return [];
	            }


	            , getGlobal: function() {
	                return [];
	            }
	        };

			db.venue('*')
			.setRestrictions(restricitonSet).find().then(function(venues) {
				assert(venues.length === 19);

				done();
			}).catch(done);
		});

		it('Filtering by constant (nullable)', function(done) {
			var restricitonSet = {
	            get: function(entityName) {

	                if (entityName === 'event') {
	                    return [{
	                          type: 'constant'
	                        , property: 'id_tenant'
	                        , path: null
	                        , fullPath: 'id_tenant'
	                        , comparator: 'equal'
	                        , value: 1
	                        , nullable: true
	                        , global: false
	                    }];
	                }
	                else return [];
	            }


	            , getGlobal: function() {
	                return [];
	            }
	        };


			db.event('*')
			.setRestrictions(restricitonSet).find().then(function(events) {
				assert(events.length > 30);

				if (events.some(function(evt) {
					return evt.id_tenant !== 1 && evt.id_tenant !== null;
				})) {
					throw new Error('invalid tenant id!');
				}
				done();
			}).catch(done);
		});


		it('Filtering by constant (nullable) on another entity', function(done) {

			var restricitonSet = {
	            get: function(entityName) {

	                if (entityName === 'venue') {
	                    return [{
	                          type: 'constant'
	                        , property: 'id_tenant'
	                        , path: ['event']
	                        , fullPath: 'event.id_tenant'
	                        , comparator: 'equal'
	                        , value: 1
	                        , nullable: true
	                        , global: false
	                    }];
	                }
	                else return [];
	            }


	            , getGlobal: function() {
	                return [];
	            }
	        };

			db.venue('*').fetchEvent('*')
			.setRestrictions(restricitonSet).find().then(function(venues) {

				// cant test this one...
				done();
			}).catch(done);
		});


		it('Filtering by constant (nullable) on another entity and one on the local entity that is global', function(done) {


			var restricitonSet = {
	            get: function(entityName) {

	                if (entityName === 'venue') {
	                    return [{
	                          type: 'constant'
	                        , property: 'id_tenant'
	                        , path: ['event']
	                        , fullPath: 'event.id_tenant'
	                        , comparator: 'equal'
	                        , value: 1
	                        , nullable: true
	                        , global: false
	                    }];
	                }
	                else return [];
	            }


	            , getGlobal: function() {
	                return [{
	                          type: 'constant'
	                        , property: 'id_tenant'
	                        , path: null
	                        , fullPath: 'id_tenant'
	                        , comparator: 'equal'
	                        , value: 1
	                        , nullable: true
	                        , global: true
	                    }];
	            }
	        };


			db.venue('*').fetchEvent('*')
			.setRestrictions(restricitonSet).find().then(function(venues) {

				if (venues.some(function(venue) {
					return venue.event.some(function(evt) {
						return evt.id_tenant !== 1 && evt.id_tenant !== null;
					});
				})) {
					throw new Error('invalid tenant id!');
				}
				done();
			}).catch(done);
		});
	});







	describe('Inserting', function() {
		it('Using a variable', function(done) {

	        var restricitonSet = {
	            get: function(entityName) {

	                if (entityName === 'event') {
	                    return [{
	                          type: 'variable'
	                        , property: 'id_tenant'
	                        , path: null
	                        , fullPath: 'id_tenant'
	                        , comparator: 'equal'
	                        , value: 'tenantId'
	                        , nullable: false
	                        , global: false
	                    }];
	                }
	                else return [];
	            }


	            , getGlobal: function() {
	                return [];
	            }
	        };


			new db.event({name: 'tenant_test'})
			.setRestrictionVariable('tenantId', 1)
			.setRestrictions(restricitonSet).save().then(function(event) {
				assert.equal(event.id_tenant, 1);
				assert.equal(event.id_venue, null);
				assert.equal(event.name, 'tenant_test');
				done();
			}).catch(done);
		});
	});
