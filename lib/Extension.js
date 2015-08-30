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





        /**
         * triggered before a model is beeing saved
         * 
         */
        , onBeforeSave: function(model, transaction, callback) {
            
            // we needd to restricct the query
            if (model._rowRestrictions) {
                try {
                    this.applyModelRestrictions(model, model._rowRestrictions.get(model.getEntityName()));
                    this.applyModelRestrictions(model, model._rowRestrictions.getGlobal(), true);
                } catch (e) {
                    return callback(e);
                }
                callback();
            }
            else callback();
        }




        /**
         * apply model methods
         */
        , applyModelRestrictions: function(model, restrictions, isGlobal) {

            // we needd to acces the orm object
            if (!ORM) ORM = model._getDatabase().getORM();


            // iterate over all restrictions, check if we need to apply them
            restrictions.forEach(function(restriction) {
                var filter;


                if (restriction.path) throw new Error('Cannot apply a row restriction with a path «'+restriction.fullPath+'» to a model! Currently only setting column values is supported!');

              

                
                // check if we must apply the restirction. this is the case
                // if the restrictions are not global or the column specified
                // on the restriction exists.
                if (!isGlobal || (isGlobal && model.getDefinition().columns[restriction.column])) {


                    // check if the colun eexists
                    if (!isGlobal && !model.getDefinition().columns[restriction.column]) throw new Error('Failed to apply the restriction «'+restriction.fullPath+'», column not found!');


                    // check if the comperator is valid
                    //if (typeof ORM[restriction.comperator] !== 'function') throw new Error('The comperator «'+restriction.comperator+'» is not supported!');



                    // create the filters from the different restriction types
                    switch (restriction.type) {
                        case 'variable':
                            if (!model._rowRestrictionVariables[restriction.value]) throw new Error('The variable «'+restriction.value+'» was not set on the model, cannot apply the row restriction!');
                            model[restriction.column] = model._rowRestrictionVariables[restriction.value];
                            break;


                        case 'function':
                            model[restriction.column] = thisContext.executeFunction(restriction.value, model._rowRestrictionVariables);
                            break;


                        case 'constant':
                            model[restriction.column] = restriction.value;
                            break;

                        default:
                            throw new Error('The row restriction type «'+restriction.type+'» is not implmented!');
                    }
                }
            }.bind(this));

        }




        /*
         * apply the row restrictions on the current query
         *
         * @param {Resource} resource the resource form the queryBuidler
         *
         * @throws {Error} if a restriction cannot be applied but must be applied or has an invalid
         */
        , onBeforePrepare: function(resource) {

            // donn't execute if the restrictions are not set
            if (resource.isRootResource() && resource.rowRestrictions) this.applyRestrictionsOnQuery(resource);
        }




        /**
         * apply restrictions on tall queries and all of the child queries
         * applies entity specific restircitons, which must be met and global
         * restrictions which must be met if the column is available
         *
         * @param {Resource} resource the resource form the queryBuidler
         *
         * @throws {Error} if a restriction cannot be applied but must be applied or has an invalid
         */
        , applyRestrictionsOnQuery: function(resource) {
            var rootResource = resource.getRootResoure();

            // apply to all children too
            if (resource.hasChildren()) resource.getChildren().forEach(this.applyRestrictionsOnQuery.bind(this));


            // apply restrictions taregted specifically on this entitiy
            this.applyRestrictions(resource, rootResource.rowRestrictions.get(resource.name));

            // apply global restrictions
            this.applyRestrictions(resource, rootResource.rowRestrictions.getGlobal(), true);
        }





        /**
         * applies the restrictions to the current resource, if applicable
         * throw an erro rif there is any problem
         *
         * @param {Resource} resource the resource form the queryBuidler
         * @param {Restriction[]} restrictions an array contaiing restriction instances
         * @param {Boolena} isGlobal indicates if the array contains global restrictions
         *
         * @throws {Error} if a restriction cannot be applied but must be applied or has an invalid
         *                 format
         */
        , applyRestrictions: function(resource, restrictions, isGlobal) {
            var   filters       = {}
                , rootResource  = resource.getRootResoure();


            // we needd to acces the orm object
            if (!ORM) ORM = resource.queryBuilder._getDatabase().getORM();


            // iterate over all restrictions, check if we need to apply them
            restrictions.forEach(function(restriction) {
                var   targetQueryBuilder
                    , filter;


                // get the target query builder form the cache or the orm
                if (filters[restriction.fullPath]) targetQueryBuilder = filters[restriction.fullPath].queryBuilder;
                else targetQueryBuilder = this.getQueryBuilderByPath(restriction.path, resource.queryBuilder);

                
                // check if we must apply the restirction. this is the case
                // if the restrictions are not global or the column specified
                // on the restriction exists.
                if (!isGlobal || (isGlobal && targetQueryBuilder && targetQueryBuilder.hasColumn(restriction.column))) {

                    // we need to apply the restriction, its not optional

                    // check if we got the queryBuilder if we're doning non globals
                    if (!isGlobal && (!targetQueryBuilder || !targetQueryBuilder.hasColumn(restriction.column))) throw new Error('Failed to apply the row restriction «'+restriction.orignalColumn+'», path or column not found!');


                    // check if the comperator is valid
                    if (typeof ORM[restriction.comperator] !== 'function') throw new Error('The row restriction comperator «'+restriction.comperator+'» is not supported!');



                    // create the filters from the different restriction types
                    switch (restriction.type) {
                        case 'variable':
                            if (!rootResource.rowRestrictionVariables[restriction.value]) throw new Error('The variable «'+restriction.value+'» was not set on the queryBuilder, cannot apply the row restriction!');
                            filter = ORM[restriction.comperator](rootResource.rowRestrictionVariables[restriction.value]);
                            break;


                        case 'function':
                            filter = ORM[restriction.comperator](thisContext.executeFunction(restriction.value, rootResource.rowRestrictionVariables));
                            break;


                        case 'constant':
                            filter = ORM[restriction.comperator](restriction.value);
                            break;

                        default:
                            throw new Error('The row restriction type «'+restriction.type+'» is not implmented!');
                    }


                    if (!filters[restriction.fullPath]) filters[restriction.fullPath] = {queryBuilder: targetQueryBuilder, columns: {}, isRemoteEntity: !!restriction.path};
                    if (!filters[restriction.fullPath].columns[restriction.column]) filters[restriction.fullPath].columns[restriction.column] = [];

                    // if the filter is nullable we need to add an or statement
                    if (restriction.nullable) filters[restriction.fullPath].columns[restriction.column].push(ORM.or(filter, null));
                    else filters[restriction.fullPath].columns[restriction.column].push(filter);
                }
            }.bind(this));



            // looks good, apply the filters
            Object.keys(filters).forEach(function(fullPath) {
                var   ORMFilter = {}
                    , entity = filters[fullPath];

                // collect filters
                Object.keys(entity.columns).forEach(function(columnName) {
                    ORMFilter[columnName] = ORM.and(entity.columns[columnName]);
                }.bind(this));


                // apply filters, we have to apply them in a different way if the filters are on the local
                // entity vs another joined entity
                if (entity.isRemoteEntity) entity.queryBuilder.getresource().setRootFilter(ORMFilter);
                else resource.queryBuilder.filter(ORMFilter);
                    

                // makie sure the entity containg the filter is joined
                // using a left join
                entity.queryBuilder.getresource().forceJoin(true);
            }.bind(this)); 
        }





        /**
         * loads the path via the queryBuilder of the resource
         *
         * @param {string[]} a list of entites to traverse
         * @param {ueryBuilder} the current queryBuilder instance
         *
         * @returns 
         */
        , getQueryBuilderByPath: function(path, queryBuilder) {

            // we need to traverse to the next entity
            if (!path) return queryBuilder;
            else if (path.length) {

                // check if this entity is aviable, return it, or null
                if (queryBuilder.has(path[0])) return this.getQueryBuilderByPath(path.slice(1), queryBuilder.get(path[0]));
                else return null;
            }
            else return queryBuilder;
        }







		/**
		 * render filter functions
		 *
		 * @private;
		 * @param {string} fn function name
		 * @param {object} variables varibales set on the queryBuilder
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
         * @returns {QueryBuilder} the queryBuilder isntance
         */
        , restrict: function(rowRestrictions) {
            this.getrootResource().rowRestrictions = rowRestrictions;
            return this;
        }






        /**
         * store rules that must be applied to the query builder. this method
         * is executed in the context of the query builder
         *
         * @param {object} an object containing all the row restrictions
         *
         * @returns {QueryBuilder} the queryBuilder isntance
         */
        , restrictModel: function(rowRestrictions) {
            Class.define(this, '_rowRestrictions', Class(rowRestrictions));
            return this;
        }





        /**
         * stores a variable that can be used by the row restrictions
         *
         * @param {string} name the name of the variable
         * @param {string|number|boolean} value the value of the variable
         *
         * @returns {QueryBuilder} the queryBuilder isntance
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






        /**
         * stores a variable that can be used by the row restrictions
         *
         * @param {string} name the name of the variable
         * @param {string|number|boolean} value the value of the variable
         *
         * @returns {QueryBuilder} the queryBuilder isntance
         */
        , setModelRestrictionVariable: function(name, value) {

            // create storage if required
            if (!this._rowRestrictionVariables) Class.define(this, '_rowRestrictionVariables', Class({}));

            // store data
            this._rowRestrictionVariables[name] = value;

            // return my self for daisy chaning
            return this;
        }





        /*
         * add my methods to the queryBuilder
         */
        , applyQueryBuilderMethods: function(definition, classDefinition) {

            // the user has to define which languages he likes to load
            // on the current query
            classDefinition.setRestrictions = this.restrict;

            // the user msut be able to set variables usedd for the restrictions
            classDefinition.setRestrictionVariable = this.setRestrictionVariable;
        }






        /*
         * add my methods to the queryBuilder
         */
        , applyModelMethods: function(definition, classDefinition) {

            // the user has to define which languages he likes to load
            // on the current query
            classDefinition.setRestrictions = this.restrictModel;

            // the user msut be able to set variables usedd for the restrictions
            classDefinition.setRestrictionVariable = this.setModelRestrictionVariable;
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
