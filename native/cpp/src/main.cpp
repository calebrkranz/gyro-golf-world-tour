#include <glad/glad.h>
#include <GLFW/glfw3.h>
#include <cmath>
#include <algorithm>

struct Vec3 { float x,y,z; };
static Vec3 add(Vec3 a,Vec3 b){return {a.x+b.x,a.y+b.y,a.z+b.z};}
static Vec3 mul(Vec3 a,float s){return {a.x*s,a.y*s,a.z*s};}
static float length(Vec3 a){return std::sqrt(a.x*a.x+a.y*a.y+a.z*a.z);}
static float aim=0, power=0, flight=0; static bool charging=false, flying=false;
static Vec3 ball{0,.08f,-5}, velocity{};
static void reset(){ball={0,.08f,-5};velocity={};flying=false;power=0;}
static void launch(){float r=aim*3.1415926f/180;velocity={std::sin(r)*(8+power*23),5+power*10,std::cos(r)*(8+power*23)};flying=true;power=0;}
static void input(GLFWwindow* w,float dt){
 if(glfwGetKey(w,GLFW_KEY_A)==GLFW_PRESS)aim-=55*dt;
 if(glfwGetKey(w,GLFW_KEY_D)==GLFW_PRESS)aim+=55*dt;
 if(glfwGetKey(w,GLFW_KEY_R)==GLFW_PRESS)reset();
 bool held=glfwGetKey(w,GLFW_KEY_SPACE)==GLFW_PRESS;
 if(held&&!flying){charging=true;power=std::min(1.f,power+dt*.75f);}
 if(!held&&charging){charging=false;if(power>.05f)launch();}
}
static void rect(float x,float y,float w,float h,float r,float g,float b){glColor3f(r,g,b);glBegin(GL_QUADS);glVertex2f(x,y);glVertex2f(x+w,y);glVertex2f(x+w,y+h);glVertex2f(x,y+h);glEnd();}
static void render(GLFWwindow* w){
 int width,height;glfwGetFramebufferSize(w,&width,&height);glViewport(0,0,width,height);glClearColor(.03f,.09f,.06f,1);glClear(GL_COLOR_BUFFER_BIT);
 glMatrixMode(GL_PROJECTION);glLoadIdentity();glOrtho(-16,16,-9,9,-1,1);glMatrixMode(GL_MODELVIEW);glLoadIdentity();
 rect(-16,-9,32,18,.08f,.21f,.12f);rect(-5,-9,10,18,.20f,.50f,.22f);
 rect(-3.8f,6.2f,7.6f,1.1f,.34f,.70f,.29f);rect(-3.8f,-7.3f,7.6f,1.1f,.34f,.70f,.29f);
 glColor3f(.96f,.84f,.30f);glPointSize(10);glBegin(GL_POINTS);glVertex2f(0,6.8f);glEnd();
 float r=aim*3.1415926f/180;glColor3f(1,.89f,.35f);glBegin(GL_LINES);glVertex2f(ball.x,ball.z);glVertex2f(ball.x+std::sin(r)*4,ball.z+std::cos(r)*4);glEnd();
 glColor3f(.98f,.98f,.96f);glPointSize(12);glBegin(GL_POINTS);glVertex2f(ball.x,ball.z);glEnd();
 rect(-7,-8.2f,14,.34f,.04f,.08f,.05f);rect(-7,-8.2f,14*power,.34f,1,.65f,.15f);glfwSwapBuffers(w);
}
int main(){if(!glfwInit())return 1;glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR,3);glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR,3);auto*w=glfwCreateWindow(1280,720,"Gyro Golf · Native",nullptr,nullptr);if(!w){glfwTerminate();return 1;}glfwMakeContextCurrent(w);glfwSwapInterval(1);if(!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress))return 1;double last=glfwGetTime();while(!glfwWindowShouldClose(w)){double now=glfwGetTime();float dt=std::min(.05,now-last);last=now;glfwPollEvents();input(w,dt);if(flying){velocity.y-=18*dt;ball=add(ball,mul(velocity,dt));if(ball.y<=.08f){ball.y=.08f;velocity=mul(velocity,.58f);velocity.y=0;if(length(velocity)<.35f)flying=false;}}render(w);}glfwDestroyWindow(w);glfwTerminate();}
