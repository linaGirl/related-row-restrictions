

DROP SCHEMA IF EXISTS related_restrictions_test CASCADE;
CREATE SCHEMA related_restrictions_test;

CREATE TABLE related_restrictions_test.venue (
      id                serial NOT NULL
    , name              varchar(100)
    , id_tenant         int not null
	, created 		    timestamp without time zone NOT NULL
    , CONSTRAINT "pk_venue" PRIMARY KEY (id)
);


CREATE TABLE related_restrictions_test.event (
      id                serial NOT NULL
    , id_tenant         int
    , id_venue          int
    , name              varchar(100)
    , CONSTRAINT "pk_event" PRIMARY KEY (id)
    , CONSTRAINT "fk_venue" FOREIGN KEY (id_venue) REFERENCES "related_restrictions_test".venue ON UPDATE CASCADE ON DELETE CASCADE
);
