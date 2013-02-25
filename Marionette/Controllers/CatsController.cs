using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace Marionette.Controllers
{
    public class Cat
    {
        public string name { get; set; }
        public string image_path { get; set; }
        public int rank { get; set; }
        public int votes { get; set; }
        public Cat(string name, string imgName, int rnk)
        {
            this.name = name;
            this.image_path = imgName;
            this.rank = rnk;
            votes = 0;
        }
    }

   


    public class CatsController : Controller
    {
        public List<Cat> Cats = new List<Cat>();

        public CatsController()
        {
            Cats.Add(new Cat("Whiskers", "/Content/images/cat1.jpg", 1));
            Cats.Add(new Cat("Smiley", "/Content/images/cat2.jpg", 2));
            Cats.Add(new Cat("Meaney", "/Content/images/cat3.jpg" ,3));
            Cats.Add(new Cat("Furball", "/Content/images/cat4.jpg",4));
        }
        //
        // GET: /Cats/

        public ActionResult Index()
        {
            return View();
        }


        public ActionResult Kittys()
        {
            return Json(Cats, JsonRequestBehavior.AllowGet);
        }

    }
}
