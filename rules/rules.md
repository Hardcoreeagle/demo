Data in the Supply is sample data it may be contain required data or not . 

Context to the project :
        project is supplychain tracibility using blockchain in Pharmasutical supplychain
            this project will be having following things
            1.Canonical model data :
                deals with sap tables and field and generate geneology of batch specific . we will be tracing the finished batched , mean while it will also generate genelogy of batches used in the production(process order) , it will be consisting of following parts 
                    business Objects : 
                        these are the object in the business which business look with precausion like materia , process order , sales order like this these are directly maped from sap tables and fields .business object are defied already globally but content of it will be batch specific example i have material now this material also present in geneology of finished batched , semifinished batches , raw material but the content of it will be batch specific .

                    relationship resolver :
                        these resolves the relationship of the business object with each other these are also maped with from sap tables and fields i'll provide you the logic for relationship resolver . 

                    Business Event resolution :
                        these are the things which tell about the objects like what happed with business objects to go for next business object i'll also provide logic for it .

                out put: fished batch full geneology using business objects ,relationship resolver , event resolver , here also generate the geneology of batches used like seminfinish , raw material using business objec ,relationship resolver , event resolver also we need the events audit trail for finish batches .

            2.Engins : 
                these are the engins which process on the output of canonical model 
                    1.GS1 engine :
                        it takes the finish batch genelogy and create the gs1 epcis event from planning to sales 

                    2.Blockchain Engine:
                        it takes the gs1 event and then create markel tree and sent it to the vchain blockchain.


Important rules to remember :
    data in the supply is sample data you just have refer it is not sufficient for createing whole finish batch geneology so you can take reference from it to compansate you can create the require business objects , currently we'll focus only on one final batch geneology you can take data from supply directory for building business objects just for one finishe batch geneology including business objects for raw material , semifinish . which was consumed in the finial batch.

    situaltion we goona focus on:
        finish batch geneology we are going to work on one finishe batch from here go for sales as well as to the planning via business objects and relationship resolver .
        for going to the back trace first we'll look for process order input batches there we see one semifinish , 2 raw material batches batches are consumed then we'll back track through it useing batchs then for same semifinish there will be process order which you will get from relationship resolver for raw material there will back like grn , purchase requisition , purchase like this you get from relationship resolver , relationship resolver create geneology for all the batches . 