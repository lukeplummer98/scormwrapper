function ExecuteScript(strId)
{
  switch (strId)
  {
      case "5s3y31TZu8h":
        Script1();
        break;
  }
}

function Script1()
{
  var player = GetPlayer();

function findLMSAPI(win) {
  if (win.hasOwnProperty("GetStudentID")) return win;

  else if (win.parent == win) return null;

  else return findLMSAPI(win.parent);
}

var lmsAPI = findLMSAPI(this);
var myName = lmsAPI.GetStudentName();
var array = myName.split(',');
var newName = array[0]; // you can also try array[1]
player.SetVar("UserName", newName); // VariableName is your Storyline Variable
}

