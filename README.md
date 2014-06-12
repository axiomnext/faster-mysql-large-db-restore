Restore large MySql database in one hour (which might take more than 10 hours otherwise)
=============================

How it works?

1. Generate a query to create table schema, procedures and functions of the source DB
2. Generate a query to find all indexes of all tables except foreign key constraints of the source DB
3. Generate a query to drop all the indexes found in step 2
4. Generate a query to insert all data of the source DB
5. Generate a query to create all the indexes found in step 2
6. Write all queries in the above order in one .sql file which is your new MySql backup. Zip it using LZ4 compression. 
7. Restore the DB from this file using normal restore command of MySql.

- Initially on an Amazon Large instance, it used to take 2 hours to backup 7GB unzipped (700MB zipped) MySql DB using _mysqldump_ utility and 8 hours to restore - Total **10 hours**.

- With this technique it takes 10 mins to backup the same DB and 50 mins to restore - **savings of 9 hours!**
