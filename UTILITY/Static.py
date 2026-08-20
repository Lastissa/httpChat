from django.conf import settings

class Static:
    project_name = 'httpchat'
    project_description= 'HttpChat is a chat app using http to connect users.'
    project_base_url = settings.PROJECT_BASE_URL or "http://localhost:8000/"
    
    
static = Static()
def reusables(request):
    """SETTING DEFAULT VALUES FOR TEMPLATES AND CUSTOM DATA I NEED TO USE IN THEM"""
    return {
        'project_name': static.project_name,
        'project_description': static.project_description,
        'project_base_url': static.project_base_url,
        'security_questions': security_questions
    }
    
    
#Only append, do not change as the index is saved in db.
security_questions = [
    "What city were you born in?, What was your first pet's name?, What is your favourite food?",
    "What is your mother's maiden name?, What was the name of your first school?, What is your favourite food?",
    "What was the make and model of your first car?, What street did you grow up on?, Who was your childhood best friend?",
    "What is the name of your favourite teacher?, What is the name of your primary school friend?, What is your favourite color?",
    "What was your first job?, What is your father's middle name?, What is your favourite holiday destination?",
    "Who bought you your first toy?, What is your favourite sports team?, What was your childhood nickname?",
    "In what city did your parents meet?, What is your favourite fruit?, which year was the first concert you attended?",
    "What is the name of the hospital you were born in?, What was your favourite subject in secondary school?, What is your father first name?",
    "What was the name of your first boss?, What is your religeon?, What was your childhood dream career?",
    "What is your grandmother's first name?, What was your favourite video game growing up?, What is your favourite colour?",
    "What was the name of your primary school?, who is your musician?, What is your favourite drink?",
    "What was your first phone numer (+234xxxx...)?, What is the name of your favourite fictional character?, What is your favourite board game (chess, monopoly. etc)?",
    "What is your favourite day of the week (monday, tues...)?, What was your favourite toy as a child?, What is your favourite meal?",
    "What is your favourite childhood memory location?, What was the name of your most loved primary school teacher?, What is your favourite quote?",
    "What was your college roommate's name?, What is your month of birth?, What is your childhoo nickname?",
    "What is the name of a country you'd love to visit?, What was your favourite cartoon growing up?, What is your favourite number?",
    "What was your first bicycle's colour?, What is your father favuoirte food?, What was your favourite fruit name?",
    "Who is your favourite author?, What was the name of your childhood dog or cat?, What is the middle name of your oldest sibling?",
    "What was the first foreign country you visited?, What is your favourite type of music?, What was your favourite childhood snack?",
    "What is the name of the church, mosque, or temple you attended growing up?, What was your favourite class project?, What is your favourite hobby?",
]