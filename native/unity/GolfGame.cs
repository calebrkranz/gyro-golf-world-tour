using UnityEngine;
namespace GyroGolf.Native {
 public sealed class GolfGame : MonoBehaviour {
  [SerializeField] Material fairwayMaterial,greenMaterial,sandMaterial; [SerializeField] GolfBall ballPrefab; [SerializeField] Camera gameplayCamera; [SerializeField] int seed=9106;
  float aim,charge; bool charging; GolfBall ball;
  void Start(){BuildCourse();ball=Instantiate(ballPrefab,new Vector3(0,.15f,-90),Quaternion.identity);gameplayCamera??=Camera.main;gameplayCamera?.GetComponent<GolfCamera>()?.Follow(ball.transform);}
  void Update(){if(!ball||ball.IsMoving)return;aim+=Input.GetAxisRaw("Horizontal")*55*Time.deltaTime;if(Input.GetKey(KeyCode.Space)){charging=true;charge=Mathf.PingPong(Time.time*1.15f,1);}else if(charging){charging=false;ball.Launch(Quaternion.Euler(0,aim,0)*Vector3.forward,Mathf.Lerp(12,42,charge));charge=0;}}
  void BuildCourse(){var rng=new System.Random(seed);var fairway=GameObject.CreatePrimitive(PrimitiveType.Cube);fairway.transform.SetParent(transform);fairway.transform.localScale=new Vector3(34,.2f,220);fairway.GetComponent<Renderer>().sharedMaterial=fairwayMaterial;var green=GameObject.CreatePrimitive(PrimitiveType.Cylinder);green.transform.SetParent(transform);green.transform.localScale=new Vector3(14,.12f,14);green.transform.localPosition=new Vector3(rng.Next(-6,7),.02f,90);green.GetComponent<Renderer>().sharedMaterial=greenMaterial;for(int i=0;i<7;i++){var bunker=GameObject.CreatePrimitive(PrimitiveType.Sphere);bunker.transform.SetParent(transform);bunker.transform.localScale=new Vector3(5,.15f,2.2f);bunker.transform.localPosition=new Vector3(rng.Next(-12,13),.02f,-65+i*22);bunker.GetComponent<Renderer>().sharedMaterial=sandMaterial;}}
 }
}
