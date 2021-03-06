const N3 = require('n3')
const parser = N3.Parser()
const N3Util = N3.Util
const fs = require('fs')
const express = require('express')
const app = express()
const path = require('path')
const zlib = require('zlib')
const resolve = require('path').resolve
const expandHomeDir = require('expand-home-dir')

const DECISIONS_DIRECTORY = path.resolve('../rdf/samples')

const RDFS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
const ELI = 'http://data.europa.eu/eli/ontology#'
const ONT = 'http://diavgeia.gov.gr/ontology/'
const DVG_ELI = 'http://diavgeia.gov.gr/eli/decision/'

app.use(express.static('public'))
app.set('views', './views')
app.set('view engine', 'pug')

app.get('/visualize', function (req, res) {
  var demoCondition = req.query.decisionFolder && req.query.iun
  var productionCondition = req.query.iun && req.query.version
  var decisionFolder
  var version
  if (demoCondition || productionCondition) {
    if (demoCondition) {
      decisionFolder = path.normalize(req.query.decisionFolder).replace(/^(\.\.[/\\])+/, '')
    } else {
      version = path.normalize(req.query.version).replace(/^(\.\.[/\\])+/, '')
    }
    var iun = path.normalize(req.query.iun).replace(/^(\.\.[/\\])+/, '')
    if (demoCondition) {
      let rdfStream = fs.createReadStream(DECISIONS_DIRECTORY + '/' + decisionFolder + '/' + iun + '.n3')
      rdfStream.on('error', () => {
        console.error('N3 file ' + DECISIONS_DIRECTORY + '/' + decisionFolder + '/' + iun + '.n3' + ' does not exist')
        res.status(404).send('Not found')
      })

      var array = {}
      rdfStream.on('open', () => {
        parser.parse(rdfStream, (err, triple, prefixes) => {
          if (err) {
            res.status(500).send('Internal Error')
          }
          if (triple) {
            var predicateAndObject = [triple.predicate, triple.object]
            if (!array[triple.subject]) {
              array[triple.subject] = [predicateAndObject]
            } else {
              array[triple.subject].push(predicateAndObject)
            }
          }
        })
      })
      rdfStream.on('end', function () {
        const generalPropertiesFormatter = new PropertiesFormatter()
        generalPropertiesFormatter.formatProperties(array)
        generalPropertiesFormatter.addConsiderationsToGeneralProperties()
        generalPropertiesFormatter.addDecisionsToGeneralProperties()
        generalPropertiesFormatter.addSignersToGeneralProperties()
        generalPropertiesFormatter.addExpensesToGeneralProperties()
        generalPropertiesFormatter.addPresentArrayToGeneralProperties()
        generalPropertiesFormatter.addVerifiersToGeneralProperties()
        res.render('index', generalPropertiesFormatter.properties)
      })
    } else {
      let webEditorConfigFile = resolve(__dirname, '../web-editor/config')
      webEditorConfigFile += process.env.NODE_ENV === 'development' ? '/development.json' : '/production.json'
      let decisionDirectory = JSON.parse(fs.readFileSync(webEditorConfigFile, 'utf8'))
      decisionDirectory = expandHomeDir(decisionDirectory['decisionsSaveDir'])
      fs.readFile(decisionDirectory + '/' + iun + '_' + version + '.n3.gz', (err, data) => {
        if (err) {
          res.status(404).send('Not found')
        }
        zlib.unzip(data, (err, decisionBuffer) => {
          if (err) {
            res.status(404).send('Not found')
          }
          // Convert decompressed buffer to readable stream in order to pass it to the N3 parser
          var stream = require('stream')
          var rdfStream = new stream.PassThrough()
          rdfStream.end(decisionBuffer)
          var array = {}
          parser.parse(rdfStream, (err, triple, prefixes) => {
            if (err) {
              res.status(500).send('Internal Error')
            }
            if (triple) {
              var predicateAndObject = [triple.predicate, triple.object]
              if (!array[triple.subject]) {
                array[triple.subject] = [predicateAndObject]
              } else {
                array[triple.subject].push(predicateAndObject)
              }
            }
          })
          rdfStream.on('end', () => {
            const generalPropertiesFormatter = new PropertiesFormatter()
            generalPropertiesFormatter.formatProperties(array)
            generalPropertiesFormatter.addConsiderationsToGeneralProperties()
            generalPropertiesFormatter.addDecisionsToGeneralProperties()
            generalPropertiesFormatter.addSignersToGeneralProperties()
            generalPropertiesFormatter.addExpensesToGeneralProperties()
            generalPropertiesFormatter.addPresentArrayToGeneralProperties()
            generalPropertiesFormatter.addVerifiersToGeneralProperties()
            res.render('index', generalPropertiesFormatter.properties)
          })
        })
      })
    }
  } else {
    res.status(404).send('Not found')
  }
})

app.listen(3333, function () {
  console.log('Visualizer listening on port 3333!')
})

class PropertiesFormatter {
  constructor () {
    this.properties = {}
    this.considerations = []
    this.decisions = []
    this.signers = []
    this.awardExpenses = []
    this.commisionWarrantExpenses = []
    this.contractExpenses = []
    this.contractExpensesAmount = []
    this.declarationSummaryExpenses = []
    this.sponsors = []
    this.donationGrantExpenses = []
    this.donationGrantSponsored = []
    this.donationGrantOrganizationSponsor = []
    this.generalSpecialSecretaryMonocraticBodyExpense = []
    this.ownershipTransferOfAssetsOrganizationSponsor = []
    this.ownershipTransferOfAssetsSponsored = []
    this.presentArray = []
    this.undertakingExpenses = []
    this.undertakingSponsored = []
    this.verifiers = []
    this.workAssignmentSupplyServicesStudiesExpenses = []
    this.workAssignmentSupplyServicesStudiesSponsors = []
    this.paymentFinalisationSponsored = []
    this.paymentFinalisationExpenses = []
    this.paymentFinalisationDocuments = []
    this.paymentFinalisationOrganizationSponsors = []
    this.paymentFinalisationWithHoldings = []
    this.paymentFinalisationKaeWithSubExpenses = []
  }

  addConsiderationsToGeneralProperties () {
    this.properties['considerations'] = this.considerations
  }

  addDecisionsToGeneralProperties () {
    this.properties['decisions'] = this.decisions
  }

  addSignersToGeneralProperties () {
    this.properties['signers'] = this.signers
  }

  addPresentArrayToGeneralProperties () {
    this.properties['presentArray'] = this.presentArray
  }

  addVerifiersToGeneralProperties () {
    this.properties['verifiers'] = this.verifiers
  }

  addExpensesToGeneralProperties () {
    this.properties['awardExpenses'] = this.awardExpenses
    this.properties['commisionWarrantExpenses'] = this.commisionWarrantExpenses
    this.properties['contractExpenses'] = this.contractExpenses
    this.properties['contractExpensesAmount'] = this.contractExpensesAmount
    this.properties['declarationSummaryExpenses'] = this.declarationSummaryExpenses
    this.properties['sponsors'] = this.sponsors
    this.properties['donationGrantExpenses'] = this.donationGrantExpenses
    this.properties['donationGrantSponsored'] = this.donationGrantSponsored
    this.properties['donationGrantOrganizationSponsor'] = this.donationGrantOrganizationSponsor
    this.properties['generalSpecialSecretaryMonocraticBodyExpense'] = this.generalSpecialSecretaryMonocraticBodyExpense
    this.properties['ownershipTransferOfAssetsOrganizationSponsor'] = this.ownershipTransferOfAssetsOrganizationSponsor
    this.properties['ownershipTransferOfAssetsSponsored'] = this.ownershipTransferOfAssetsSponsored
    this.properties['undertakingExpenses'] = this.undertakingExpenses
    this.properties['undertakingSponsored'] = this.undertakingSponsored
    this.properties['workAssignmentSupplyServicesStudiesExpenses'] = this.workAssignmentSupplyServicesStudiesExpenses
    this.properties['workAssignmentSupplyServicesStudiesSponsors'] = this.workAssignmentSupplyServicesStudiesSponsors
    this.properties['paymentFinalisationExpenses'] = this.paymentFinalisationExpenses
    this.properties['paymentFinalisationSponsored'] = this.paymentFinalisationSponsored
    this.properties['paymentFinalisationOrganizationSponsors'] = this.paymentFinalisationOrganizationSponsors
    this.properties['paymentFinalisationWithHoldings'] = this.paymentFinalisationWithHoldings
    this.properties['paymentFinalisationKaeWithSubExpenses'] = this.paymentFinalisationKaeWithSubExpenses
    this.properties['paymentFinalisationDocuments'] = this.paymentFinalisationDocuments
  }

  formatProperties (array) {
    var decisionIunVersion = {}
    for (var subject in array) {
      array[subject].forEach(predicatePair => {
        this._findPredicateValue(subject, 'eli', 'title', predicatePair)
        this._findPredicateValue(subject, 'eli', 'date_publication', predicatePair)
        let iun = this._findPredicateValue(subject, 'ont', 'iun', predicatePair)
        if (iun) {
          decisionIunVersion['iun'] = iun
        }
        let version = this._findPredicateValue(subject, 'ont', 'version', predicatePair)
        if (version) {
          decisionIunVersion['version'] = version
        }
        this._findPredicateValue(subject, 'ont', 'protocol_number', predicatePair)
        this._findPredicateValue(subject, 'ont', 'thematic_category', predicatePair)
        this._findPredicateValue(subject, 'ont', 'recipients', predicatePair)
        this._findPredicateValue(subject, 'ont', 'recipient_for_share', predicatePair)
        this._findPredicateValue(subject, 'ont', 'internal_distribution', predicatePair)
        this._findPredicateValue(subject, 'ont', 'has_private_data', predicatePair)
        this._findPredicateValue(subject, 'rdfs', 'type', predicatePair)
        // Government Institution Details
        this._findPredicateValue(subject, 'ont', 'government_institution_name', predicatePair)
        this._findPredicateValue(subject, 'ont', 'government_institution_general_administration', predicatePair)
        this._findPredicateValue(subject, 'ont', 'government_institution_department', predicatePair)
        this._findPredicateValue(subject, 'ont', 'government_institution_address', predicatePair)
        this._findPredicateValue(subject, 'ont', 'government_institution_postalcode', predicatePair)
        this._findPredicateValue(subject, 'ont', 'government_institution_phone', predicatePair)
        this._findPredicateValue(subject, 'ont', 'government_institution_fax', predicatePair)
        this._findPredicateValue(subject, 'ont', 'government_institution_email', predicatePair)
        this._findPredicateValue(subject, 'ont', 'government_institution_information', predicatePair)
        // Rest General Properties
        this._findPredicateValue(subject, 'ont', 'decision_call', predicatePair)

        // Special Properties

        // Appointment

        // Fek
        this._findPredicateValue(subject, 'ont', 'fek_year', predicatePair)
        this._findPredicateValue(subject, 'ont', 'fek_issue', predicatePair)
        this._findPredicateValue(subject, 'ont', 'fek_number', predicatePair)

        this._findPredicateValue(subject, 'ont', 'number_employees', predicatePair)
        this._findPredicateValue(subject, 'ont', 'appointment_employer_org', predicatePair)

        // Award
        this._findPredicateValue(subject, 'ont', 'has_related_declaration_summary', predicatePair)
        // BalanceAccount
        this._findPredicateValue(subject, 'ont', 'financial_year', predicatePair)
        this._findPredicateValue(subject, 'ont', 'balance_account_type', predicatePair)
        this._findPredicateValue(subject, 'ont', 'balance_account_time_period', predicatePair)
        this._findPredicateValue(subject, 'ont', 'has_related_institution', predicatePair)
        this._findPredicateValue(subject, 'ont', 'is_balance_account_approval_for_org', predicatePair)
        // BudgetApproval
        this._findPredicateValue(subject, 'ont', 'is_budget_approval_for_org', predicatePair)
        this._findPredicateValue(subject, 'ont', 'budget_type', predicatePair)
        this._findPredicateValue(subject, 'ont', 'budget_category', predicatePair)
        // Circular
        this._findPredicateValue(subject, 'ont', 'circular_number', predicatePair)
        // CollegialBodyCommisionWorkingGroup
        this._findPredicateValue(subject, 'ont', 'collegial_body_decision_type', predicatePair)
        this._findPredicateValue(subject, 'ont', 'collegial_body_party_type', predicatePair)
        // CommisionWarrant
        this._findPredicateValue(subject, 'ont', 'primary_officer', predicatePair)
        this._findPredicateValue(subject, 'ont', 'secondary_officer', predicatePair)
        // Contract
        this._findPredicateValue(subject, 'ont', 'contract_start', predicatePair)
        this._findPredicateValue(subject, 'ont', 'contract_end', predicatePair)
        this._findPredicateValue(subject, 'ont', 'contract_decision_type', predicatePair)
        this._findPredicateValue(subject, 'ont', 'contract_is_co_funded', predicatePair)
        // DeclarationSummary
        this._findPredicateValue(subject, 'ont', 'contract_type', predicatePair)
        this._findPredicateValue(subject, 'ont', 'selection_criterion', predicatePair)
        this._findPredicateValue(subject, 'ont', 'tendering_procedure', predicatePair)
        this._findPredicateValue(subject, 'ont', 'government_institution_budget_code', predicatePair)
        this._findPredicateValue(subject, 'ont', 'has_related_undertaking', predicatePair)
        // DevelopmentLawContract, DisciplinaryAcquitance (no specific object properties)
        // DonationGrant
        this._findPredicateValue(subject, 'ont', 'kae', predicatePair)
        this._findPredicateValue(subject, 'ont', 'donation_type', predicatePair)
        // EvaluationReportOfLaw, ExpenditureApproval
        // GeneralSpecialSecretaryMonocraticBody
        this._findPredicateValue(subject, 'ont', 'position', predicatePair)
        this._findPredicateValue(subject, 'ont', 'position_org', predicatePair)
        this._findPredicateValue(subject, 'ont', 'position_decision_type', predicatePair)
        // InvestmentPlacing
        // LegislativeDecree
        this._findPredicateValue(subject, 'ont', 'legislative_decree_number', predicatePair)
        // Normative
        this._findPredicateValue(subject, 'ont', 'normative_number', predicatePair)
        this._findPredicateValue(subject, 'ont', 'normative_type', predicatePair)
        // OccupationInvitation
        this._findPredicateValue(subject, 'ont', 'vacancy_opening_type', predicatePair)
        // Opinion
        this._findPredicateValue(subject, 'ont', 'opinion_question_number', predicatePair)
        this._findPredicateValue(subject, 'ont', 'opinion_question_summary', predicatePair)
        this._findPredicateValue(subject, 'ont', 'opinion_history', predicatePair)
        this._findPredicateValue(subject, 'ont', 'opinion_analysis', predicatePair)
        this._findPredicateValue(subject, 'ont', 'opinion_conclusion', predicatePair)
        this._findPredicateValue(subject, 'ont', 'opinion_government_institution_type', predicatePair)
        // OtherDecisions, OtherDevelopmentLaw
        this._findPredicateValue(subject, 'ont', 'publish_via', predicatePair)
        // OwnershipTransferOfAssets
        this._findPredicateValue(subject, 'ont', 'asset_name', predicatePair)
        // Records
        this._findPredicateValue(subject, 'ont', 'record_number', predicatePair)
        // ServiceChange
        this._findPredicateValue(subject, 'ont', 'service_change_decision_type', predicatePair)
        // SpatialPlanningDecisions
        this._findPredicateValue(subject, 'ont', 'has_municipality', predicatePair)
        this._findPredicateValue(subject, 'ont', 'spatial_planning_decision_type', predicatePair)
        // StartProductionalFunctionOfInvestment, SuccessfulAppointedRunnerUpList
        this._findPredicateValue(subject, 'ont', 'has_related_occupation_invitation', predicatePair)
        // Undertaking
        this._findPredicateValue(subject, 'ont', 'partialead', predicatePair)
        this._findPredicateValue(subject, 'ont', 'entry_number', predicatePair)
        this._findPredicateValue(subject, 'ont', 'recalled_expense', predicatePair)
        // WorkAssignmentSupplyServicesStudies
        this._findPredicateValue(subject, 'ont', 'work_assignment_etc_category', predicatePair)
        // PaymentFinalisation
        this._findPredicateValue(subject, 'ont', 'reason_multiple_afm_ignorance', predicatePair)
        this._findPredicateValue(subject, 'ont', 'payment_number', predicatePair)
        this._findPredicateValue(subject, 'ont', 'multiple_afm_ignorance_text', predicatePair)
      })
    }
    /* A second iteration is necessary here, because in the future n3 generator may change
     * (e.g. Considerations and Decisions entities may be parsed first). Thus we should guarantee
     * that we have found iun and version in order to recognize the rest entities.
     */
    var decisionPrefix = DVG_ELI + decisionIunVersion['iun'] + '/' + decisionIunVersion['version'] + '/'
    for (subject in array) {
      if (subject === (decisionPrefix + 'AfterDecision')) {
        array[subject].forEach(predicatePair => {
          this._findPredicateValue('AfterDecision', 'ont', 'has_text', predicatePair)
        })
      } else if (subject === (decisionPrefix + 'PreConsideration')) {
        array[subject].forEach(predicatePair => {
          this._findPredicateValue('PreConsideration', 'ont', 'has_text', predicatePair)
        })
      } else if (subject.indexOf(decisionPrefix + 'Consideration/') > -1) {
        let considerationSplitArray = subject.split('/')
        let considerationNumber = considerationSplitArray[considerationSplitArray.length - 1]
        array[subject].forEach(predicatePair => {
          this._findPredicateValue('Consideration', 'ont', 'has_text', predicatePair, considerationNumber)
          this._findPredicateValue('Consideration', 'ont', 'considers', predicatePair, considerationNumber)
        })
      } else if (subject.indexOf(decisionPrefix + 'Decision/') > -1) {
        let decisionSplitArray = subject.split('/')
        let decisionNumber = decisionSplitArray[decisionSplitArray.length - 1]
        array[subject].forEach(predicatePair => {
          this._findPredicateValue('Decision', 'ont', 'has_text', predicatePair, decisionNumber)
          this._findPredicateValue('Decision', 'ont', 'considers', predicatePair, decisionNumber)
        })
      } else if (subject.indexOf(decisionPrefix + 'Signer/') > -1) {
        let signersArray = subject.split('/')
        let signerNumber = signersArray[signersArray.length - 1]
        array[subject].forEach(predicatePair => {
          this._findPredicateValue('Signer', 'ont', 'signer_job', predicatePair, signerNumber)
          this._findPredicateValue('Signer', 'ont', 'signer_name', predicatePair, signerNumber)
          // TODO Maybe Diavgeia can link to the Signer on its website
          // this._findPredicateValue('Signer', 'ont', 'signer_name', predicatePair, signerNumber)
        })
      } else if (subject.indexOf(decisionPrefix + 'Expense/') > -1) {
        var expenseArray = subject.split('/')
        var expenseNumber = expenseArray[expenseArray.length - 1]
        if (this.properties['decision_type_english'] === 'Award' || this.properties['decision_type_english'] === 'WorkAssignmentSupplyServicesStudies') {
          /* 1 has_expense
           * 1 expense_amount
           * n has_sponsored and n Sponsored entitites
           * Sponsors have afm, afm_type and name
           */
          array[subject].forEach(predicatePair => {
            this._findPredicateValue(this.properties['decision_type_english'] + 'Expense', 'ont', 'expense_amount', predicatePair)
            this._findPredicateValue(this.properties['decision_type_english'] + 'Expense', 'ont', 'expense_currency', predicatePair)
            this._findPredicateValue(this.properties['decision_type_english'] + 'Expense', 'ont', 'cpv', predicatePair)

            var sponsored
            for (sponsored in array) {
              if (sponsored.indexOf(decisionPrefix + 'Sponsored/') > -1) {
                let sponsoredArray = sponsored.split('/')
                let sponsoredNumber = sponsoredArray[sponsoredArray.length - 1]
                array[sponsored].forEach(predicatePairSponsored => {
                  this._findPredicateValue(this.properties['decision_type_english'] + 'Expense', 'ont', 'afm', predicatePairSponsored, sponsoredNumber)
                  this._findPredicateValue(this.properties['decision_type_english'] + 'Expense', 'ont', 'afm_type', predicatePairSponsored, sponsoredNumber)
                  this._findPredicateValue(this.properties['decision_type_english'] + 'Expense', 'ont', 'name', predicatePairSponsored, sponsoredNumber)
                })
              }
            }
          })
        } else if (this.properties['decision_type_english'] === 'Contract') {
          /*
           * n has_expense
           * Each expense has n sponsors
           */
          array[subject].forEach(predicatePair => {
            this._findPredicateValue('ContractExpenseAmount', 'ont', 'expense_amount', predicatePair, expenseNumber)
            this._findPredicateValue('ContractExpenseAmount', 'ont', 'expense_currency', predicatePair, expenseNumber)
            var sponsored
            for (sponsored in array) {
              if (sponsored.indexOf(decisionPrefix + 'Sponsored/') > -1) {
                let sponsoredArray = sponsored.split('/')
                let sponsoredNumber = sponsoredArray[sponsoredArray.length - 1]
                array[sponsored].forEach(predicatePairSponsored => {
                  this._findPredicateValue('ContractExpense', 'ont', 'afm', predicatePairSponsored, sponsoredNumber)
                  this._findPredicateValue('ContractExpense', 'ont', 'afm_type', predicatePairSponsored, sponsoredNumber)
                  this._findPredicateValue('ContractExpense', 'ont', 'name', predicatePairSponsored, sponsoredNumber)
                })
              }
            }
          })
        } else if (this.properties['decision_type_english'] === 'DeclarationSummary') {
          /*
           * 1 has_expense
           * No sponsors
           * Each expense has cpv, expense_amount and expense_currency
           */
          array[subject].forEach(predicatePair => {
            this._findPredicateValue('DeclarationSummaryExpense', 'ont', 'expense_amount', predicatePair, expenseNumber)
            this._findPredicateValue('DeclarationSummaryExpense', 'ont', 'expense_currency', predicatePair, expenseNumber)
            this._findPredicateValue('DeclarationSummaryExpense', 'ont', 'cpv', predicatePair, expenseNumber)
          })
        } else if (this.properties['decision_type_english'] === 'DonationGrant' || this.properties['decision_type_english'] === 'ExpenditureApproval') {
          //  DonationGrant and ExpenditureApproval share the same Entities and properties
          /*
           * N expenses
           * All expenses share the same OrganizationSponsor (has_organization_sponsor property)
           * Each expense has 1 sponsored
           * OrganizationSponsor and Sponsored have the same properties (afm, afm_type, name)
           */
          array[subject].forEach(predicatePair => {
            this._findPredicateValue('DonationGrantExpenses', 'ont', 'expense_amount', predicatePair, expenseNumber)
            this._findPredicateValue('DonationGrantExpenses', 'ont', 'expense_currency', predicatePair, expenseNumber)
            this._findPredicateValue('DonationGrantExpenses', 'ont', 'cpv', predicatePair, expenseNumber)
            this._findPredicateValue('DonationGrantExpenses', 'ont', 'kae', predicatePair, expenseNumber)
            var entities
            for (entities in array) {
              if (entities.indexOf(decisionPrefix + 'Sponsored/') > -1) {
                let sponsoredArray = entities.split('/')
                let sponsoredNumber = sponsoredArray[sponsoredArray.length - 1]
                array[entities].forEach(predicatePairSponsored => {
                  this._findPredicateValue('DonationGrantSponsored', 'ont', 'afm', predicatePairSponsored, sponsoredNumber)
                  this._findPredicateValue('DonationGrantSponsored', 'ont', 'afm_type', predicatePairSponsored, sponsoredNumber)
                  this._findPredicateValue('DonationGrantSponsored', 'ont', 'name', predicatePairSponsored, sponsoredNumber)
                })
              } else if (entities.indexOf(decisionPrefix + 'OrganizationSponsor/') > -1) {
                let organizationSponsorArray = entities.split('/')
                let organizationNumber = organizationSponsorArray[organizationSponsorArray.length - 1]
                array[entities].forEach(predicatePairOrganizationSponsor => {
                  this._findPredicateValue('DonationGrantOrganizationSponsor', 'ont', 'afm', predicatePairOrganizationSponsor, organizationNumber)
                  this._findPredicateValue('DonationGrantOrganizationSponsor', 'ont', 'afm_type', predicatePairOrganizationSponsor, organizationNumber)
                  this._findPredicateValue('DonationGrantOrganizationSponsor', 'ont', 'name', predicatePairOrganizationSponsor, organizationNumber)
                })
              }
            }
          })
        } else if (this.properties['decision_type_english'] === 'GeneralSpecialSecretaryMonocraticBody') {
          /*
           * 1 Expense with just expense_amount and expense_currency
           */
          array[subject].forEach(predicatePair => {
            this._findPredicateValue('GeneralSpecialSecretaryMonocraticBodyExpense', 'ont', 'expense_amount', predicatePair, expenseNumber)
            this._findPredicateValue('GeneralSpecialSecretaryMonocraticBodyExpense', 'ont', 'expense_currency', predicatePair, expenseNumber)
          })
        } else if (this.properties['decision_type_english'] === 'OwnershipTransferOfAssets') {
          /*
           * 1 Expense with 1 OrganizationSponsor and N Sponsored
           */
          var entities
          for (entities in array) {
            if (entities.indexOf(decisionPrefix + 'Sponsored/') > -1) {
              let sponsoredArray = entities.split('/')
              let sponsoredNumber = sponsoredArray[sponsoredArray.length - 1]
              array[entities].forEach(predicatePairSponsored => {
                this._findPredicateValue('OwnershipTransferOfAssetsSponsored', 'ont', 'afm', predicatePairSponsored, sponsoredNumber)
                this._findPredicateValue('OwnershipTransferOfAssetsSponsored', 'ont', 'afm_type', predicatePairSponsored, sponsoredNumber)
                this._findPredicateValue('OwnershipTransferOfAssetsSponsored', 'ont', 'name', predicatePairSponsored, sponsoredNumber)
              })
            } else if (entities.indexOf(decisionPrefix + 'OrganizationSponsor/') > -1) {
              let organizationSponsorArray = entities.split('/')
              let organizationNumber = organizationSponsorArray[organizationSponsorArray.length - 1]
              array[entities].forEach(predicatePairOrganizationSponsor => {
                this._findPredicateValue('OwnershipTransferOfAssetsOrganizationSponsor', 'ont', 'afm', predicatePairOrganizationSponsor, organizationNumber)
                this._findPredicateValue('OwnershipTransferOfAssetsOrganizationSponsor', 'ont', 'afm_type', predicatePairOrganizationSponsor, organizationNumber)
                this._findPredicateValue('OwnershipTransferOfAssetsOrganizationSponsor', 'ont', 'name', predicatePairOrganizationSponsor, organizationNumber)
              })
            }
          }
        } else if (this.properties['decision_type_english'] === 'PaymentFinalisation') {
          /*
           * N expenses
           * For the time being, all expenses share the same OrganizationSponsor
           * Each expense has M has_document, 1 payment_reason, L WithHolding entitites, 1 Sponsored, 1 payment_with_withholdings and 1 payment_with_withholdings_currency, 1 cpv, 1 kae, 1 expense_amount and 1 expense_amount_currency.
           * Government institutions should explicit fill payment_with_withholdings and payment_with_withholdings_currency, because
           * in the case of multiple currencies we will not be able to subtract withholdings from expense_amount.
           */
          array[subject].forEach(predicatePair => {
            this._findPredicateValue('PaymentFinalisationExpenses', 'ont', 'expense_amount', predicatePair, expenseNumber)
            this._findPredicateValue('PaymentFinalisationExpenses', 'ont', 'expense_amount_currency', predicatePair, expenseNumber)
            this._findPredicateValue('PaymentFinalisationExpenses', 'ont', 'cpv', predicatePair, expenseNumber)
            this._findPredicateValue('PaymentFinalisationExpenses', 'ont', 'kae', predicatePair, expenseNumber)
            this._findPredicateValue('PaymentFinalisationExpenses', 'ont', 'payment_with_withholdings', predicatePair, expenseNumber)
            this._findPredicateValue('PaymentFinalisationExpenses', 'ont', 'payment_with_withholdings_currency', predicatePair, expenseNumber)
            this._findPredicateValue('PaymentFinalisationExpenses', 'ont', 'payment_reason', predicatePair, expenseNumber)
            this._findPredicateValue('PaymentFinalisationExpenses', 'ont', 'has_document', predicatePair, expenseNumber)
            this._findPredicateValue('PaymentFinalisationExpenses', 'ont', 'has_withholding', predicatePair, expenseNumber)
            this._findPredicateValue('PaymentFinalisationExpenses', 'ont', 'has_withkaesubexpense', predicatePair, expenseNumber)
            var entities
            for (entities in array) {
              if (entities.indexOf(decisionPrefix + 'Sponsored/') > -1) {
                let sponsoredArray = entities.split('/')
                let sponsoredNumber = sponsoredArray[sponsoredArray.length - 1]
                array[entities].forEach(predicatePairSponsored => {
                  this._findPredicateValue('PaymentFinalisationSponsored', 'ont', 'afm', predicatePairSponsored, sponsoredNumber)
                  this._findPredicateValue('PaymentFinalisationSponsored', 'ont', 'afm_type', predicatePairSponsored, sponsoredNumber)
                  this._findPredicateValue('PaymentFinalisationSponsored', 'ont', 'name', predicatePairSponsored, sponsoredNumber)
                })
              } else if (entities.indexOf(decisionPrefix + 'OrganizationSponsor/') > -1) {
                let organizationSponsorArray = entities.split('/')
                let organizationNumber = organizationSponsorArray[organizationSponsorArray.length - 1]
                array[entities].forEach(predicatePairOrganizationSponsor => {
                  this._findPredicateValue('PaymentFinalisationOrganizationSponsor', 'ont', 'afm', predicatePairOrganizationSponsor, organizationNumber)
                  this._findPredicateValue('PaymentFinalisationOrganizationSponsor', 'ont', 'afm_type', predicatePairOrganizationSponsor, organizationNumber)
                  this._findPredicateValue('PaymentFinalisationOrganizationSponsor', 'ont', 'name', predicatePairOrganizationSponsor, organizationNumber)
                })
              } else if (entities.indexOf(decisionPrefix + 'WithHolding/') > -1) {
                let withHoldingsArray = entities.split('/')
                let withHoldingNumber = withHoldingsArray[withHoldingsArray.length - 1]
                array[entities].forEach(predicatePairWithHolding => {
                  this._findPredicateValue('PaymentFinalisationWithHolding', 'ont', 'withholding_expense', predicatePairWithHolding, withHoldingNumber)
                  this._findPredicateValue('PaymentFinalisationWithHolding', 'ont', 'withholding_expense_currency', predicatePairWithHolding, withHoldingNumber)
                  this._findPredicateValue('PaymentFinalisationWithHolding', 'ont', 'withholding_text', predicatePairWithHolding, withHoldingNumber)
                })
              } else if (entities.indexOf(decisionPrefix + 'WithKaeSubExpense/') > -1) {
                let WithKaeSubExpenseArray = entities.split('/')
                let withKaeSubExpenseNumber = WithKaeSubExpenseArray[WithKaeSubExpenseArray.length - 1]
                array[entities].forEach(predicatePairWithHolding => {
                  this._findPredicateValue('PaymentFinalisationKaeWithSubExpenses', 'ont', 'expense_amount', predicatePairWithHolding, withKaeSubExpenseNumber)
                  this._findPredicateValue('PaymentFinalisationKaeWithSubExpenses', 'ont', 'expense_amount_currency', predicatePairWithHolding, withKaeSubExpenseNumber)
                  this._findPredicateValue('PaymentFinalisationKaeWithSubExpenses', 'ont', 'kae', predicatePairWithHolding, withKaeSubExpenseNumber)
                })
              }
            }
          })
        }
      } else if (subject.indexOf(decisionPrefix + 'ExpenseWithKae') > -1) {
        if (this.properties['decision_type_english'] === 'CommisionWarrant') {
          let expensesWithKaeArray = subject.split('/')
          let expenseWithKaeNumber = expensesWithKaeArray[expensesWithKaeArray.length - 1]
          array[subject].forEach(predicatePair => {
            this._findPredicateValue('CommisionWarrantExpense', 'ont', 'expense_amount', predicatePair, expenseWithKaeNumber)
            this._findPredicateValue('CommisionWarrantExpense', 'ont', 'expense_amount_currency', predicatePair, expenseWithKaeNumber)
            this._findPredicateValue('CommisionWarrantExpense', 'ont', 'kae', predicatePair, expenseWithKaeNumber)
          })
        } else if (this.properties['decision_type_english'] === 'Undertaking') {
          /*
           * n ExpenseWithKae
           * Each ExpenseWithKae has kae, kae_budget_remainder, kae_credit_remainder, expense_amount and expense_amount_currency
           */
          let expensesWithKaeArray = subject.split('/')
          let expenseWithKaeNumber = expensesWithKaeArray[expensesWithKaeArray.length - 1]
          array[subject].forEach(predicatePair => {
            this._findPredicateValue('UndertakingExpense', 'ont', 'expense_amount', predicatePair, expenseWithKaeNumber)
            this._findPredicateValue('UndertakingExpense', 'ont', 'expense_amount_currency', predicatePair, expenseWithKaeNumber)
            this._findPredicateValue('UndertakingExpense', 'ont', 'kae', predicatePair, expenseWithKaeNumber)
            this._findPredicateValue('UndertakingExpense', 'ont', 'kae_budget_remainder', predicatePair, expenseWithKaeNumber)
            this._findPredicateValue('UndertakingExpense', 'ont', 'kae_credit_remainder', predicatePair, expenseWithKaeNumber)
          })
        }
        for (entities in array) {
          if (entities.indexOf(decisionPrefix + 'Sponsored/') > -1) {
            let sponsoredArray = entities.split('/')
            let sponsoredNumber = sponsoredArray[sponsoredArray.length - 1]
            array[entities].forEach(predicatePairSponsored => {
              this._findPredicateValue('UndertakingExpense', 'ont', 'afm', predicatePairSponsored, sponsoredNumber)
              this._findPredicateValue('UndertakingExpense', 'ont', 'afm_type', predicatePairSponsored, sponsoredNumber)
              this._findPredicateValue('UndertakingExpense', 'ont', 'name', predicatePairSponsored, sponsoredNumber)
            })
          }
        }
      } else if (subject.indexOf(decisionPrefix + 'Present/') > -1) {
        let presentArray = subject.split('/')
        let presentNumber = presentArray[presentArray.length - 1]
        array[subject].forEach(predicatePair => {
          this._findPredicateValue('Present', 'ont', 'present_name', predicatePair, presentNumber)
          this._findPredicateValue('Present', 'ont', 'present_title', predicatePair, presentNumber)
        })
      } else if (subject.indexOf(decisionPrefix + 'Verification/') > -1) {
        let verificationArray = subject.split('/')
        let verificationNumber = verificationArray[verificationArray.length - 1]
        array[subject].forEach(predicatePair => {
          this._findPredicateValue('Verification', 'ont', 'has_text', predicatePair, verificationNumber)
          this._findPredicateValue('Verification', 'ont', 'verified_by', predicatePair, verificationNumber)
        })
      }
    }
  }

  _formatObjectProperty (obj, predicate, predicatePair, entityIndex, pushToArray = false) {
    if (!obj[entityIndex - 1]) {
      obj[entityIndex - 1] = {}
    }
    if (pushToArray) {
      if (obj[entityIndex - 1][predicate] !== undefined) {
        obj[entityIndex - 1][predicate].push(N3Util.getLiteralValue(predicatePair[1]))
      } else {
        obj[entityIndex - 1][predicate] = []
        obj[entityIndex - 1][predicate].push(N3Util.getLiteralValue(predicatePair[1]))
      }
    } else {
      obj[entityIndex - 1][predicate] = N3Util.getLiteralValue(predicatePair[1])
    }
  }

  _findPredicateValue (subject, ontology, predicateSearch, predicatePair, entityIndex, mapToOtherEntityIndex) {
    var predicate = predicatePair[0]
    var value = predicatePair[1]
    var fullPredicate
    switch (ontology) {
      case 'ont':
        fullPredicate = ONT
        break
      case 'eli':
        fullPredicate = ELI
        break
      case 'rdfs':
        fullPredicate = RDFS
        break
    }
    fullPredicate += predicateSearch
    if (fullPredicate === predicate) {
      if (subject === 'AfterDecision') {
        this.properties['AfterDecision'] = N3Util.getLiteralValue(value)
      } else if (subject === 'PreConsideration') {
        this.properties['PreConsideration'] = N3Util.getLiteralValue(value)
      } else if (subject === 'Consideration') {
        if (predicateSearch === 'has_text') {
          this._formatObjectProperty(this.considerations, 'has_text', predicatePair, entityIndex)
        } else if (predicateSearch === 'considers') {
          if (!this.considerations[entityIndex - 1]) {
            this.considerations[entityIndex - 1] = {}
          }
          if (!this.considerations[entityIndex - 1]['links']) {
            this.considerations[entityIndex - 1]['links'] = []
          }
          this.considerations[entityIndex - 1]['links'].push(predicatePair[1])
        }
      } else if (subject === 'Decision') {
        if (predicateSearch === 'has_text') {
          this._formatObjectProperty(this.decisions, 'has_text', predicatePair, entityIndex)
        } else if (predicateSearch === 'considers') {
          if (!this.decisions[entityIndex - 1]) {
            this.decisions[entityIndex - 1] = {}
          }
          if (!this.decisions[entityIndex - 1]['links']) {
            this.decisions[entityIndex - 1]['links'] = []
          }
          this.decisions[entityIndex - 1]['links'].push(predicatePair[1])
        }
      } else if (subject === 'Signer') {
        if (predicateSearch === 'signer_job' || predicateSearch === 'signer_name') {
          this._formatObjectProperty(this.signers, predicateSearch, predicatePair, entityIndex)
        }
      } else if (subject === 'Present') {
        if (predicateSearch === 'present_name' || predicateSearch === 'present_title') {
          this._formatObjectProperty(this.presentArray, predicateSearch, predicatePair, entityIndex)
        }
      } else if (subject === 'Verification') {
        if (predicateSearch === 'verified_by') {
          let signerIndexSplit = predicatePair[1].split('/')
          let signerIndex = signerIndexSplit[signerIndexSplit.length - 1]
          this._formatObjectProperty(this.verifiers, 'signer_index', ['', '"' + signerIndex + '"'], entityIndex)
        } else if (predicateSearch === 'has_text') {
          this._formatObjectProperty(this.verifiers, predicateSearch, predicatePair, entityIndex)
        }
      } else if (subject === 'AwardExpense') {
        if (predicateSearch === 'expense_amount' || predicateSearch === 'expense_currency') {
          this.awardExpenses[predicateSearch] = N3Util.getLiteralValue(predicatePair[1])
        } else if (predicateSearch === 'afm' || predicateSearch === 'afm_type' || predicateSearch === 'name') {
          this._formatObjectProperty(this.sponsors, predicateSearch, predicatePair, entityIndex)
        }
      } else if (subject === 'WorkAssignmentSupplyServicesStudiesExpense') {
        if (predicateSearch === 'expense_amount' || predicateSearch === 'expense_currency' || predicateSearch === 'cpv') {
          this.workAssignmentSupplyServicesStudiesExpenses[predicateSearch] = N3Util.getLiteralValue(predicatePair[1])
        } else if (predicateSearch === 'afm' || predicateSearch === 'afm_type' || predicateSearch === 'name') {
          this._formatObjectProperty(this.workAssignmentSupplyServicesStudiesSponsors, predicateSearch, predicatePair, entityIndex)
        }
      } else if (subject === 'CommisionWarrantExpense') {
        if (predicateSearch === 'expense_amount' || predicateSearch === 'expense_currency' || predicateSearch === 'kae') {
          this._formatObjectProperty(this.commisionWarrantExpenses, predicateSearch, predicatePair, entityIndex)
        }
      } else if (subject === 'ContractExpense') {
        let afmCondition = predicateSearch === 'afm' || predicateSearch === 'afm_type' || predicateSearch === 'name'
        if (afmCondition) {
          this._formatObjectProperty(this.contractExpenses, predicateSearch, predicatePair, entityIndex)
        }
      } else if (subject === 'DeclarationSummaryExpense') {
        if (predicateSearch === 'expense_amount' || predicateSearch === 'expense_currency' || predicateSearch === 'cpv') {
          this._formatObjectProperty(this.declarationSummaryExpenses, predicateSearch, predicatePair, entityIndex)
        }
      } else if (subject === 'ContractExpenseAmount') {
        let expensesCondition = predicateSearch === 'expense_amount' || predicateSearch === 'expense_currency'
        if (expensesCondition) {
          this._formatObjectProperty(this.contractExpensesAmount, predicateSearch, predicatePair, entityIndex)
        }
      } else if (subject === 'DonationGrantExpenses') {
        let expensesCondition = predicateSearch === 'expense_amount' || predicateSearch === 'expense_currency' || predicateSearch === 'name' || predicateSearch === 'cpv' || predicateSearch === 'kae'
        if (expensesCondition) {
          this._formatObjectProperty(this.donationGrantExpenses, predicateSearch, predicatePair, entityIndex)
        }
      } else if (subject === 'DonationGrantSponsored') {
        let sponsoredCondition = predicateSearch === 'afm' || predicateSearch === 'afm_type' || predicateSearch === 'name'
        if (sponsoredCondition) {
          this._formatObjectProperty(this.donationGrantSponsored, predicateSearch, predicatePair, entityIndex)
        }
      } else if (subject === 'DonationGrantOrganizationSponsor') {
        let sponsoredCondition = predicateSearch === 'afm' || predicateSearch === 'afm_type' || predicateSearch === 'name'
        if (sponsoredCondition) {
          this._formatObjectProperty(this.donationGrantOrganizationSponsor, predicateSearch, predicatePair, entityIndex)
        }
      } else if (subject === 'GeneralSpecialSecretaryMonocraticBodyExpense') {
        if (predicateSearch === 'expense_amount' || predicateSearch === 'expense_currency') {
          this._formatObjectProperty(this.generalSpecialSecretaryMonocraticBodyExpense, predicateSearch, predicatePair, entityIndex)
        }
      } else if (subject === 'OwnershipTransferOfAssetsSponsored') {
        let sponsoredCondition = predicateSearch === 'afm' || predicateSearch === 'afm_type' || predicateSearch === 'name'
        if (sponsoredCondition) {
          this._formatObjectProperty(this.ownershipTransferOfAssetsSponsored, predicateSearch, predicatePair, entityIndex)
        }
      } else if (subject === 'OwnershipTransferOfAssetsOrganizationSponsor') {
        let sponsoredCondition = predicateSearch === 'afm' || predicateSearch === 'afm_type' || predicateSearch === 'name'
        if (sponsoredCondition) {
          this._formatObjectProperty(this.ownershipTransferOfAssetsOrganizationSponsor, predicateSearch, predicatePair, entityIndex)
        }
      } else if (subject === 'UndertakingExpense') {
        let undertakingCondition = predicateSearch === 'expense_amount' || predicateSearch === 'expense_amount_currency' || predicateSearch === 'kae' || predicateSearch === 'kae_budget_remainder' || predicateSearch === 'kae_credit_remainder'
        if (undertakingCondition) {
          this._formatObjectProperty(this.undertakingExpenses, predicateSearch, predicatePair, entityIndex)
        } else if (predicateSearch === 'afm' || predicateSearch === 'afm_type' || predicateSearch === 'name') {
          this._formatObjectProperty(this.undertakingSponsored, predicateSearch, predicatePair, entityIndex)
        }
      } else if (subject === 'PaymentFinalisationExpenses') {
        let cond = predicateSearch === 'expense_amount' || predicateSearch === 'expense_amount_currency' || predicateSearch === 'cpv'
        cond = cond || predicateSearch === 'kae' || predicateSearch === 'payment_with_withholdings' || predicateSearch === 'payment_with_withholdings_currency'
        cond = cond || predicateSearch === 'payment_reason'
        if (cond) {
          this._formatObjectProperty(this.paymentFinalisationExpenses, predicateSearch, predicatePair, entityIndex)
        } else if (predicateSearch === 'has_withholding') {
          let withholdingIndexArray = predicatePair[1].split('/')
          let withholdingIndex = withholdingIndexArray[withholdingIndexArray.length - 1]
          this._formatObjectProperty(this.paymentFinalisationExpenses, 'withholding_index', ['', '"' + (withholdingIndex - 1) + '"'], entityIndex, true)
        } else if (predicateSearch === 'has_withkaesubexpense') {
          let kaewithsubexpenseArray = predicatePair[1].split('/')
          let kaewithsubexpenseIndex = kaewithsubexpenseArray[kaewithsubexpenseArray.length - 1]
          this._formatObjectProperty(this.paymentFinalisationExpenses, 'kaesubexpense', ['', '"' + (kaewithsubexpenseIndex - 1) + '"'], entityIndex, true)
        }
        if (predicateSearch === 'has_document') {
          this._formatObjectProperty(this.paymentFinalisationDocuments, 'has_document', predicatePair, entityIndex, true)
        }
      } else if (subject === 'PaymentFinalisationSponsored') {
        let cond = predicateSearch === 'afm' || predicateSearch === 'afm_type' || predicateSearch === 'name'
        if (cond) {
          this._formatObjectProperty(this.paymentFinalisationSponsored, predicateSearch, predicatePair, entityIndex)
        }
      } else if (subject === 'PaymentFinalisationOrganizationSponsor') {
        let cond = predicateSearch === 'afm' || predicateSearch === 'afm_type' || predicateSearch === 'name'
        if (cond) {
          this._formatObjectProperty(this.paymentFinalisationOrganizationSponsors, predicateSearch, predicatePair, entityIndex)
        }
      } else if (subject === 'PaymentFinalisationWithHolding') {
        let cond = predicateSearch === 'withholding_expense' || predicateSearch === 'withholding_expense_currency' || predicateSearch === 'withholding_text'
        if (cond) {
          this._formatObjectProperty(this.paymentFinalisationWithHoldings, predicateSearch, predicatePair, entityIndex)
        }
      } else if (subject === 'PaymentFinalisationKaeWithSubExpenses') {
        let cond = predicateSearch === 'expense_amount' || predicateSearch === 'expense_amount_currency' || predicateSearch === 'kae'
        if (cond) {
          this._formatObjectProperty(this.paymentFinalisationKaeWithSubExpenses, predicateSearch, predicatePair, entityIndex)
        }
      } else if (predicateSearch === 'date_publication') {
        var dateLiteral = N3Util.getLiteralValue(value)
        dateLiteral = dateLiteral.split('-')
        dateLiteral = dateLiteral[2] + '/' + dateLiteral[1] + '/' + dateLiteral[0]
        this.properties[predicateSearch] = dateLiteral
      } else if (predicateSearch === 'thematic_category') {
        const thematicCategoriesTranslation = {
          Employment: 'ΑΠΑΣΧΟΛΗΣΗ ΚΑΙ ΕΡΓΑΣΙΑ',
          Industry: 'BIOMHXANIA',
          AgricultureForestryFishery: 'ΓΕΩΡΓΙΑ, ΔΑΣΟΚΟΜΙΑ ΚΑΙ ΑΛΙΕΙΑ',
          Geography: 'ΓΕΩΓΡΑΦΙΑ',
          Fiscals: 'ΔΗΜΟΣΙΟΝΟΜΙΚΑ',
          NutritionAgriculturalProducts: 'ΔΙΑΤΡΟΦΗ ΚΑΙ ΓΕΩΡΓΙΚΑ ΠΡΟΪΟΝΤΑ',
          InternationalOrganizations: 'ΔΙΕΘΝΕΙΣ ΟΡΓΑΝΙΣΜΟΙ',
          InternationalRelations: 'ΔΙΕΘΝΕΙΣ ΣΧΕΣΕΙΣ',
          Laws: 'ΔΙΚΑΙΟ',
          Energy: 'ΕΝΕΡΓΕΙΑ',
          CommunicationEducation: 'ΕΠΙΚΟΙΝΩΝΙΑ ΚΑΙ ΜΟΡΦΩΣΗ',
          Science: 'ΕΠΙΣΤΗΜΕΣ',
          BusinessCompetition: 'ΕΠΙΧΕΙΡΗΣΕΙΣ ΚΑΙ ΑΝΤΑΓΩΝΙΣΜΟΣ',
          EuropeanUnion: 'ΕΥΡΩΠΑΪΚΗ ΕΝΩΣΗ',
          SocialIssues: 'ΚΟΙΝΩΝΙΚΑ ΘΕΜΑΤΑ',
          Transport: 'ΜΕΤΑΦΟΡΕΣ',
          EconomicTradeExchanges: 'ΟΙΚΟΝΟΜΙΚΕΣ ΚΑΙ ΕΜΠΟΡΙΚΕΣ ΣΥΝΑΛΛΑΓΕΣ',
          EconomicActivity: 'ΟΙΚΟΝΟΜΙΚΗ ΖΩΗ',
          ManufactureTechnologyResearch: 'ΠΑΡΑΓΩΓΗ, ΤΕΧΝΟΛΟΓΙΑ ΚΑΙ ΕΡΕΥΝΑ',
          Environment: 'ΠΕΡΙΒΑΛΛΟΝ',
          PoliticalLife: 'ΠΟΛΙΤΙΚΗ ΖΩΗ',
          PublicAdministration: 'ΔΗΜΟΣΙΑ ΔΙΟΙΚΗΣΗ'
        }
        if (!this.properties[predicateSearch]) {
          this.properties[predicateSearch] = [thematicCategoriesTranslation[N3Util.getLiteralValue(value)]]
        } else {
          this.properties[predicateSearch].push(thematicCategoriesTranslation[N3Util.getLiteralValue(value)])
        }
      } else if (predicateSearch === 'internal_distribution' || predicateSearch === 'recipient_for_share' || predicateSearch === 'recipients') {
        if (!this.properties[predicateSearch]) {
          this.properties[predicateSearch] = [N3Util.getLiteralValue(value)]
        } else {
          this.properties[predicateSearch].push([N3Util.getLiteralValue(value)])
        }
      } else if (predicateSearch === 'type') {
        let decisionType = this._findDecisionType(value)
        if (decisionType) {
          this.properties['decision_type'] = decisionType
          this.properties['decision_type_english'] = value.replace(ONT, '')
        }
        return decisionType
      } else if (predicateSearch === 'has_municipality') {
        let kallikratis = require('./assets/kallikratis.json')
        this.properties['municipality'] = kallikratis[value]
      } else {
        let literalValue = N3Util.getLiteralValue(value)
        this.properties[predicateSearch] = literalValue
        return literalValue
      }
      return null
    }
  }

  _findDecisionType (value) {
    var translations = {}
    translations[ONT + 'Law'] = 'Νόμος'
    translations[ONT + 'LegislativeDecree'] = 'Πράξη Νομοθετικού Περιεχομένου'
    translations[ONT + 'Normative'] = 'Κανονιστική Πράξη'
    translations[ONT + 'Circular'] = 'Εγκύκλιος'
    translations[ONT + 'Records'] = 'Πρακτικά'
    translations[ONT + 'EvaluationReportOfLaw'] = 'Έκθεση Αποτίμησης για την κατάσταση της υφιστάμενης νομοθεσίας'
    translations[ONT + 'Opinion'] = 'Γνωμοδότηση'
    translations[ONT + 'BudgetApproval'] = 'Έγκριση Προϋπολογισμού'
    translations[ONT + 'Undertaking'] = 'Ανάληψη Υποχρέωσης'
    translations[ONT + 'ExpenditureApproval'] = 'Έγκριση Δαπάνης'
    translations[ONT + 'PaymentFinalisation'] = 'Οριστικοποίηση Πληρωμής'
    translations[ONT + 'CommisionWarrant'] = 'Επιτροπικό Ένταλμα'
    translations[ONT + 'BalanceAccount'] = 'Ισολογισμός - Απολογισμός'
    translations[ONT + 'DonationGrant'] = 'Δωρεά - Επιχορήγηση'
    translations[ONT + 'OwnershipTransferOfAssets'] = 'Παραχώρηση Χρήσης Περιουσιακών Στοιχείων'
    translations[ONT + 'Appointment'] = 'Διορισμός'
    translations[ONT + 'SuccessfulAppointedRunnerUpList'] = 'Πίνακες Επιτυχόντων, Διοριστέων & Επιλαχόντων'
    translations[ONT + 'GeneralSpecialSecretaryMonocraticBody'] = 'Πράξη που αφορά σε θέση γενικού - ειδικού γραμματέα - μονομελές όργανο'
    translations[ONT + 'CollegialBodyCommisionWorkingGroup'] = 'Πράξη που αφορά σε συλλογικό όργανο - επιτροπή - ομάδα εργασίας - ομάδα έργου - μέλη συλλογικού οργάνου'
    translations[ONT + 'OccupationInvitation'] = 'Προκήρυξη Πλήρωσης Θέσεων'
    translations[ONT + 'Contract'] = 'Σύμβαση'
    translations[ONT + 'ServiceChange'] = 'Υπηρεσιακή Μεταβολή'
    translations[ONT + 'DisciplinaryAcquitance'] = 'Αθωωτικη Πειθαρχική Απόφαση'
    translations[ONT + 'StartProductionalFunctionOfInvestment'] = 'Απόφαση Έναρξης Παραγωγικής Λειτουργίας Επένδυσης'
    translations[ONT + 'InvestmentPlacing'] = 'Πράξη Υπαγωγής Επενδύσεων'
    translations[ONT + 'DevelopmentLawContract'] = 'Σύμβαση - Πράξεις Αναπτυξιακών Νόμων'
    translations[ONT + 'OtherDevelopmentLaw'] = 'Άλλη πράξη αναπτυξιακού νόμου'
    translations[ONT + 'WorkAssignmentSupplyServicesStudies'] = 'Ανάθεση Έργων / Προμηθειών / Υπηρεσιών / Μελετών'
    translations[ONT + 'Award'] = 'Κατακύρωση'
    translations[ONT + 'DeclarationSummary'] = 'Περίληψη Διακήρυξης'
    translations[ONT + 'OtherDecisions'] = 'Λοιπές Ατομικές Διοικητικές Πράξεις'
    translations[ONT + 'PublicPrototypeDocuments'] = 'Δημόσια Πρότυπα Έγγραφα'
    translations[ONT + 'SpatialPlanningDecisions'] = 'Πράξεις Χωροταξικού - Πολεοδομικού Περιεχομένου'
    return translations[value]
  }
}
