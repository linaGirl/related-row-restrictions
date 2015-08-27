!function() {
    'use strict';


    var   Class                     = require('ee-class')
        , log                       = require('ee-log')
        , type                      = require('ee-types')
        , RelatedExtension          = require('related-extension');


    var   thisContext
        , ORM;




    module.exports = new Class({
        inherits: RelatedExtension


        // the extensions name
        , _name: 'related-row-restrictions'



        , init: function init(options) {
            init.super.call(this);

            // store this context so we'll have acces in some
            // methods attached to the model
            thisContext = this;
        }






        /*
         * add our forced filters
         */
        , onBeforePrepare: function(resource, definition) {
            var   query        = resource.getQuery()
			    , ORM 	       = resource.queryBuilder._getDatabase().getORM()
                , rootResource = resource.getRootResoure();




			if (rootResource.rowRestrictions && Object.keys(rootResource.rowRestrictions).length) {
				// we got some restrictions

				Object.keys(rootResource.rowRestrictions).forEach(function(columnName) {
					var   filterList = []
						, ORMFilter = {};

					// iterate through all restrictions for that column
					rootResource.rowRestrictions[columnName].forEach(function(restriction) {
						var filter;

						// check if the operator is valid
						if (typeof ORM[restriction.operator] !== 'function') throw new Error('The operator «'+restriction.operator+'» is not supported!');

                        
                        // only global row restrictions must also be applied to subselects
                        if (resource.isRootResource() || restriction.global) {


                            // create the filters from the different restriction types
    						switch (restriction.type) {
    							case 'variable':
    								if (!rootResource.rowRestrictionVariables[restriction.value]) throw new Error('The variable «'+restriction.value+'» was not set on the queryuilder, cannot apply the row restriction!');
    								filter = ORM[restriction.operator](rootResource.rowRestrictionVariables[restriction.value]);
    								break;


    							case 'function':
    								filter = ORM[restriction.operator](thisContext.executeFunction(restriction.value, rootResource.rowRestrictionVariables));
    								break;


    							case 'constant':
    								filter = ORM[restriction.operator](restriction.value);
    								break;

    							default:
    								throw new Error('The row restriction type «'+restriction.type+'» is not implmented!');
    						}


    						// if the filter is nullable we need to add an or statement
    						if (restriction.nullable) filterList.push(ORM.or(filter, null));
    						else filterList.push(filter);
                        }
					}.bind(this));


					// is there a filter?
					if (filterList.length) {

						// check if we neeed to load another entity
						if (columnName.indexOf('.') === -1) {
							ORMFilter[columnName] = ORM.and(filterList);

							resource.queryBuilder.filter(ORMFilter);
						}
						else {
							ORMFilter[columnName.substr(columnName.lastIndexOf('.')+1)] = ORM.and(filterList);

							thisContext.applyFilterToSubEntity(resource.queryBuilder, columnName.split('.'), ORMFilter);
						}
					}
				}.bind(this));
			}
        }




        /**
         * subqueries must be filtered as well
         *
         */
        , onBeforePrepareSubqueries: function(resource, definition) {
            this.onBeforePrepare(resource, definition);
        }




        , getFilteredEntites: function() {

        }




        , getSelectedEntities: function() {

        }




		/**
		 * apply a filter to a subentity
		 *
		 *
		 */
		, applyFilterToSubEntity: function(queryBuilder, pathParts, filter) {
			if (pathParts.length === 2) {

				// apply filter now
				queryBuilder.get(pathParts[0], filter);
			}
			else if (pathParts.length > 2) {

				// get newxt level
				this.applyFilterToSubEntity(queryBuilder.get(pathParts[0]), pathParts.slice(1), filter);
			}
			else throw new Error('Cannot apply filter to subentity. The path is too short!');
		}






		/**
		 * render filter functions
		 *
		 * @private;
		 * @param {string} fn function name
		 * @param {object} variables varibales set on the querybuilder
		 *
		 * @returns {*} the result of the function
		 */
		, executeFunction: function(fn, variables) {

			switch (fn) {
				case 'now()':
					return new Date();

				default:
					throw new Error('The function «'+fn+'» is not known!');
			}
		}





		/**
		 * store rules that must be applied to the query builder. this method
		 * is executed in the context of the query builder
		 *
		 * @param {object} an object containing all the row restrictions
		 *
		 * @returns {QueryBuilder} the querybuilder isntance
		 */
		, restrict: function(rowRestrictions) {
			this.getrootResource().rowRestrictions = rowRestrictions;
            return this;
		}





		/**
		 * stores a variable that can be used by the row restrictions
		 *
		 * @param {string} name the name of the variable
		 * @param {string|number|boolean} value the value of the variable
		 *
		 * @returns {QueryBuilder} the querybuilder isntance
		 */
		, setRestrictionVariable: function(name, value) {
			var resource = this.getrootResource();

			// create storage if required
			if (!resource.rowRestrictionVariables) resource.rowRestrictionVariables = {};

			// store data
			resource.rowRestrictionVariables[name] = value;

			// return my self for daisy chaning
            return this;
		}





        /*
         * add my methods to the querybuilder
         */
        , applyQueryBuilderMethods: function(definition, classDefinition) {

            // the user has to define which languages he likes to load
            // on the current query
            classDefinition.restrict = this.restrict;

			// the user msut be able to set variables usedd for the restrictions
            classDefinition.setRestrictionVariable = this.setRestrictionVariable;
        }






        /*
         * checks if this extension should be applied to the
         * current model. yes, it should ;)
         */
        , useOnModel: function() {
            return true;
        }
    });
}();
