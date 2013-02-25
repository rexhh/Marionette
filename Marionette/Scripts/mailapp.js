BBCloneMail = (function(Backbone, Marionette){
  "use strict";

  var App = new Marionette.Application();

  App.addRegions({
    nav: "#navigation",
    main: "#main",
    appSelector: "#app-selector"
  });

  App.on("initialize:after", function(){
    if (Backbone.history){
      Backbone.history.start();
    }
  });

  App.startSubApp = function(appName, args){
    var currentApp = App.module(appName);
    if (App.currentApp === currentApp){ return; }

    if (App.currentApp){
      App.currentApp.stop();
    }

    App.currentApp = currentApp;
    currentApp.start(args);
  };

  return App;
})(Backbone, Marionette);


// AppController
// --------------
//
// A base controller object to hide a lot of the 
// guts and implementation detail of showing the
// lists and individual items

BBCloneMail.AppController = (function(App, Marionette){
  "use strict";

  var AppController = Marionette.Controller.extend({
    constructor: function(options){
      options = options || {};

      this.mainRegion = options.mainRegion;
      this.navRegion = options.navRegion;
      this.appSelectorRegion = options.appSelectorRegion;

      Marionette.Controller.prototype.constructor.call(this, options);
    },

    // show this component in the app
    show: function(){
      this._showAppSelector("mail");
      Marionette.triggerMethod.call(this, "show");
    },

    // show the specified component, closing any currently
    // displayed component before showing the new one
    showComponent: function(component){
      if (this._currentComponent){
        this._currentComponent.close();
      }

      component.show();
      this._currentComponent = component;
    },

    // Show the app selector drop down list, which allows
    // the app to be changed from mail app to contacts app
    _showAppSelector: function(appName){
      var appSelector = new App.AppSelector({
        region: this.appSelectorRegion,
        currentApp: appName
      });

      appSelector.show();
    }
  });

  return AppController;
})(BBCloneMail, Marionette);


// Application Selector
// --------------------
//
// Display the list of applications to choose from
// and move to that application when the selection is changed
BBCloneMail.AppSelector = (function(App, Marionette){

  // Selector View
  // -------------

  SelectorView = Marionette.ItemView.extend({
    template: "#app-selector-template",
    tagName: "select",

    events: {
      "change": "appSelected"
    },

    appSelected: function(e){
      e.preventDefault();

      var name = $(e.currentTarget).val();
      this.trigger("app:selected", name);
    },

    setCurrent: function(appName){
      this.$("[value=" + appName + "]").attr("selected", "selected");
    }
  });
  
  // Component Controller
  // --------------------
  //
  // Runs the app selector component, coordinating
  // between the view and the various other parts of
  // the app selection process

  return Marionette.Controller.extend({

    // Hang on to the region in which the 
    // selector will be displayed
    initialize: function(options){
      this.region = options.region;
      this.currentApp = options.currentApp;
      App.vent.on("app:started", this._setCurrentApp, this);
    },

    onClose: function(){
      App.vent.off("app:started", this._setCurrentApp, this);
    },

    // show the selector view and set up the
    // event handler for changing the current app
    show: function(){
      this.selectorView = this._getSelectorView();
      this.region.show(this.selectorView);
    },

    _getSelectorView: function(){
      var view = new SelectorView();

      // set the current app on first render
      this.listenTo(view, "render", function(){
        this._setCurrentApp(this.currentApp);
      });

      // listen to the app selection change
      this.listenTo(view, "app:selected", this._appSelected);

      return view;
    },

    // store the current app and show it in the view
    _setCurrentApp: function(appName){
      this.selectorView.setCurrent(appName);
      this.currentApp = appName;
    },

    // handle app selection change
    _appSelected: function(app){
      Backbone.history.navigate(app, true);
    },

    // close the region and view when this component closes
    onClose: function(){
      if (this.region){
        this.region.close();
        delete this.region;
      }
    }
  });

})(BBCloneMail, Marionette);


BBCloneMail.module("MailApp", function(MailApp, App){
  "use strict";

  // Controller
  // ----------

  MailApp.Controller = App.AppController.extend({
    initialize: function(){
      _.bindAll(this, "_showMail", "_showMailList");
    },
    
    showInbox: function(){
      var mailbox = new MailApp.Mail.Mailbox();
      $.when(mailbox.getAll())
        .then(this._showMailList);

      Backbone.history.navigate("#mail");
    },

    showMailById: function(id){
      var mailbox = new MailApp.Mail.Mailbox();
      $.when(mailbox.getById(id))
        .then(this._showMail);
    },

    showMailByCategory: function(category){
      var mailbox = new MailApp.Mail.Mailbox();
      $.when(mailbox.getByCategory(category))
        .then(this._showMailList);

      Backbone.history.navigate("#mail/categories/" + category);
    },

    onShow: function(){
      this._showCategories();
    },

    // show the list of categories for the mail app
    _showCategories: function(){
      var categoryNav = new App.MailApp.Navigation.Menu({
        region: this.navRegion
      });

      this.listenTo(categoryNav, "category:selected", this._categorySelected);

      categoryNav.show();
    },

    _categorySelected: function(category){
      if (category){
        this.showMailByCategory(category);
      } else {
        this.showInbox();
      }
    },

    // show a single email in the app
    _showMail: function(email){
      var viewer = new App.MailApp.Mailboxes.MailViewer({
        region: this.mainRegion,
        email: email
      });

      this.showComponent(viewer);

      Backbone.history.navigate("#mail/inbox/" + email.id);
    },

    // show a list of email in the apps - the inbox, 
    // or a category, for example
    _showMailList: function(emailList){
      var inbox = new App.MailApp.Mailboxes.Inbox({
        region: this.mainRegion,
        email: emailList
      });

      // when an email is selected, show it
      inbox.on("email:selected", function(email){
        this._showMail(email);
      }, this);

      this.showComponent(inbox);
    }
  });

  // Initializers
  // ------------

  MailApp.addInitializer(function(args){
    MailApp.controller = new MailApp.Controller({
      mainRegion: args.mainRegion,
      navRegion: args.navRegion,
      appSelectorRegion: args.appSelectorRegion
    });

    MailApp.controller.show();
    App.vent.trigger("app:started", "mail");
  });

  MailApp.addFinalizer(function(){
    if (MailApp.controller){
      MailApp.controller.close();
      delete MailApp.controller;
    }
  });

});




BBCloneMail.module("MailApp", {
  startWithParent: false,

  define: function(MailApp, App, Backbone, Marionette, $, _){
    "use strict";

    // Mail Router
    // -----------

    var Router = Backbone.Router.extend({
      routes: {
        "": "showInbox",
        "mail": "showInbox",
        "mail/categories/:id": "showMailByCategory",
        "mail/inbox/:id": "showMailById"
      },

      // route filter before method
      // https://github.com/boazsender/backbone.routefilter
      before: function(){
        App.startSubApp("MailApp", {
          mainRegion: App.main,
          navRegion: App.nav,
          appSelectorRegion: App.appSelector
        });
      },

      showInbox: function(){
        App.MailApp.controller.showInbox();
      },

      showMailById: function(id){
        App.MailApp.controller.showMailById(id);
      },

      showMailByCategory: function(category){
        App.MailApp.controller.showMailByCategory(category);
      }
    });

    // Initializer
    // -----------
    //
    // The router must always be alive with the app, so that it can
    // respond to route changes and start up the right sub-app 
    App.addInitializer(function(){
      var router = new Router();
    });
  }
});







BBCloneMail.module("ContactsApp", {
  startWithParent: false,
  define: function(ContactsApp, App){

    // Contacts Router
    // -----------

    var Router = Backbone.Router.extend({
      routes: {
        "contacts": "showContacts",
      },

      // route filter before method
      // https://github.com/boazsender/backbone.routefilter
      before: function(){
        App.startSubApp("ContactsApp", {
          mainRegion: App.main,
          navRegion: App.nav,
          appSelectorRegion: App.appSelector
        });
      },

      showContacts: function(){
        App.ContactsApp.controller.showContacts();
      }
    });

    // Initializer
    // -----------
    //
    // The router must always be alive with the app, so that it can
    // respond to route changes and start up the right sub-app 
    App.addInitializer(function(){
      var router = new Router();
    });

  }
});


BBCloneMail.module("ContactsApp", function(ContactsApp, App){
  "use strict";
 
  // Contact List Views
  // ------------------

  ContactsApp.ContactView = Marionette.ItemView.extend({
    template: "#contact-item-template",
    tagName: "li"
  });

  ContactsApp.ContactListView = Marionette.CollectionView.extend({
    itemView: ContactsApp.ContactView,
    tagName: "ul",
    id: "contact-list",
    className: "contact-list"
  });
  
  // Category View
  // -------------

  ContactsApp.CategoryView = Marionette.ItemView.extend({
    template: "#contact-categories-view-template"
  });

  // Contact App Controller
  // -----------------------

  ContactsApp.Controller = App.AppController.extend({
    initialize: function(options){
      this.repo = options.repo;
    },

    onShow: function(){
      this._showCategories();
    },

    showContacts: function(){
      var that = this;

      $.when(this.repo.getAll()).then(function(contacts){
        var view = new ContactsApp.ContactListView({
          collection: contacts
        });

        that.mainRegion.show(view);

        Backbone.history.navigate("contacts");
      });
    },

    // show the list of categories for the mail app
    _showCategories: function(){
      var categoryNav = new ContactsApp.CategoryView();
      this.navRegion.show(categoryNav);
    },

    getContacts: function(callback){
      return this.contactsRepo.getAll();
    }

  });

  // Initializers and Finalizers
  // ---------------------------

  ContactsApp.addInitializer(function(args){
    var repo = new ContactsApp.Contacts.Repository();

    ContactsApp.controller = new ContactsApp.Controller({
      mainRegion: args.mainRegion,
      navRegion: args.navRegion,
      appSelectorRegion: args.appSelectorRegion,
      repo: repo
    });

    ContactsApp.controller.show();
    App.vent.trigger("app:started", "contacts");
  });

  ContactsApp.addFinalizer(function(){
    if (ContactsApp.controller){
      ContactsApp.controller.close();
      delete ContactsApp.controller;
    }
  });

});



BBCloneMail.module("ContactsApp.Contacts", function(Contacts, App, Backbone, Marionette, $, _){
  "use strict";

  // Entities
  // --------

  var Contact = Backbone.Model.extend({
    initialize: function(){
      Backbone.Compute(this);
    },

    fullName: { 
      fields: ["firstName", "lastName"], 
      compute: function(fields){
        return fields.lastName + ", " + fields.firstName;
      }
    }
  });

  var ContactCollection = Backbone.Collection.extend({
    model: Contact,
    url: "/contacts"
  });

  // Contacts Repository
  // -------------------

  Contacts.Repository = Marionette.Controller.extend({

    getAll: function(){
      var deferred = $.Deferred();

      this._getContacts(function(contacts){
        deferred.resolve(contacts);
      });

      return deferred.promise();
    },

    _getContacts: function(callback){
      var contactCollection = new ContactCollection();
      contactCollection.on("reset", callback);
      contactCollection.fetch();
    }

  });
});


BBCloneMail.module("MailApp.Categories", function(Categories, App, Backbone, Marionette, $, _){
  "use strict";

  // Entities
  // --------

  var Category = Backbone.Model.extend({});

  var CategoryCollection = Backbone.Collection.extend({
    model: Category,
    url: "/categories"
  });

  // Controller
  // ----------

  function Controller(){}

  _.extend(Controller.prototype, {

    getAll: function(){
      var deferred = $.Deferred();

      var categoryCollection = new CategoryCollection();
      categoryCollection.on("reset", function(categories){
        deferred.resolve(categories);
      });

      categoryCollection.fetch();
      return deferred.promise();
    }

  });

  // Init & Finialize
  // ----------------

  Categories.addInitializer(function(){
    var controller = new Controller();
    Categories.controller = controller;

    App.reqres.addHandler("mail:categories", controller.getAll, controller);
  });

  Categories.addFinalizer(function(){
    App.reqres.removeHandler("mail:categories");
    delete Categories.controller;
  });
});


// Navigation Menu
// ---------------
//
// Show the list of mail categories and handle
// clicking them to navigate to the mail category

BBCloneMail.module("MailApp.Navigation", function(Nav, App, Backbone, Marionette, $, _){
  "use strict";

  // Category List View
  // ------------------
  // Display a list of categories in the navigation area

  Nav.CategoryListView = Marionette.ItemView.extend({
    template: "#mail-categories-view-template",

    events: {
      "click .mail-category": "mailCategoryClicked"
    },

    mailCategoryClicked: function(e){
      e.preventDefault();

      var category = $(e.currentTarget).data("category");
      this.trigger("category:selected", category);
    }
  });

  // Navigation Component Controller
  // -------------------------------

  Nav.Menu = Marionette.Controller.extend({
    
    initialize: function(options){
      this.region = options.region;
    },

    show: function(){
      var showCatListView = _.bind(this._showCatListView, this);
      this._getCategories(showCatListView);
    },

    _showCatListView: function(categories){
      var view = new Nav.CategoryListView({
        collection: categories
      });

      this.listenTo(view, "category:selected", this._categorySelected);

      this.region.show(view);
    },

    _categorySelected: function(category){
      this.trigger("category:selected", category);
    },

    _getCategories: function(callback){
      var categoryLoader = App.request("mail:categories");
      $.when(categoryLoader).then(callback);
    }
  });

});

BBCloneMail.module("MailApp.Mail", function(Mail, App, Backbone, Marionette, $, _){
  "use strict";

  // Entities
  // --------

  var Email = Backbone.Model.extend({
  });

  var EmailCollection = Backbone.Collection.extend({
    model: Email,
    url: "/email"
  });

  // Mailbox Controller
  // ------------------

  Mail.Mailbox = Marionette.Controller.extend({
    getAll: function(){
      var deferred = $.Deferred();

      this._getMail(function(mail){
        deferred.resolve(mail);
      });

      return deferred.promise();
    },

    getById: function(id){
      var deferred = $.Deferred();

      this._getMail(function(mailList){
        var mail = mailList.get(id);
        deferred.resolve(mail);
      });

      return deferred.promise();
    },

    getByCategory: function(categoryName){
      var deferred = $.Deferred();

      this._getMail(function(unfiltered){
        var filtered = unfiltered.filter(function(mail){
          var categories = mail.get("categories");
          return _.include(categories, categoryName);
        });

        var mail = new EmailCollection(filtered);
        deferred.resolve(mail);
      });

      return deferred.promise();
    },

    _getMail: function(callback){
      var emailCollection = new EmailCollection();
      emailCollection.on("reset", callback);
      emailCollection.fetch();
    }
  });
});


// Mail Viewer
// -----------
//
// View an individual email

BBCloneMail.module("MailApp.Mailboxes", function(Mailboxes, App, Backbone, Marionette, $, _){
  "use strict";
  
  // Mail View
  // ---------
  // Displays the contents of a single mail item.

  Mailboxes.MailView = Marionette.ItemView.extend({
    template: "#email-view-template",
    tagName: "ul",
    className: "email-list"
  });

  Mailboxes.MailViewer = Marionette.Controller.extend({

    initialize: function(options){
      this.region = options.region;
      this.email = options.email;
    },

    show: function(){
      var itemView = new Mailboxes.MailView({
        model: this.email
      });

      this.region.show(itemView);
    }
  });

});


// Mail Inbox
// ----------
//
// Display a list of email

BBCloneMail.module("MailApp.Mailboxes", function(Mailboxes, App, Backbone, Marionette, $, _){
  "use strict";

  // Mail Preview
  // ------------
  // Displays an individual preview line item, when multiple
  // mail items are displayed as a list. When clicked, the
  // email item contents will be displayed.

  Mailboxes.MailPreview = Marionette.ItemView.extend({
    template: "#email-preview-template",
    tagName: "li",

    triggers: {
      "click": "selected"
    }
  });

  // Mail List View
  // --------------
  // Displays a list of email preview items.

  Mailboxes.MailListView = Marionette.CollectionView.extend({
    tagName: "ul",
    className: "email-list",
    itemViewEventPrefix: "email",
    itemView: Mailboxes.MailPreview
  });

  // Mailbox Component Controller
  // ----------------------------
  //
  // Manages the states / transitions between displaying a
  // list of items, and single email item view

  Mailboxes.Inbox = Marionette.Controller.extend({
    initialize: function(options){
      this.region = options.region;
      this.email = options.email;
    },

    show: function(){
      var listView = new Mailboxes.MailListView({
        collection: this.email
      });

      this.listenTo(listView, "email:selected", this._emailSelected);

      this.region.show(listView);
    },

    _emailSelected: function(view, args){
      this.trigger("email:selected", args.model);
    }
  });

});