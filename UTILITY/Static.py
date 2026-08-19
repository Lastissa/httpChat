class Static:
    project_name = 'httpchat'
    project_description= 'HttpChat is a chat app using http to connect users.'
    project_base_url = 'http://localhost:8000/'
    
    
static = Static()
def reusables(request):
    """SETTING DEFAULT VALUES FOR TEMPLATES AND CUSTOM DATA I NEED TO USE IN THEM"""
    return {
        'project_name': static.project_name,
        'project_description': static.project_description,
        'project_base_url': static.project_base_url,
        'security_questions': security_questions
    }
    
    
    
security_questions = [
    "What city were you born in?, What was your first pet's name?, What is your favourite food?",
    "What is your mother's maiden name?, What was the name of your first school?, What is your favourite book?",
    "What was the make and model of your first car?, What street did you grow up on?, Who was your childhood best friend?",
    "What is the name of your favourite teacher?, What was your high school mascot?, What is your favourite movie?",
    "What was your first job?, What is your father's middle name?, What is your favourite holiday destination?",
    "What was the name of your first stuffed animal or toy?, What is your favourite sports team?, What was your childhood nickname?",
    "In what city did your parents meet?, What is your favourite dessert?, What was the first concert you attended?",
    "What is the name of the hospital you were born in?, What was your favourite subject in school?, What is your dream job?",
    "What was the name of your first boss?, What is your favourite season?, What was your childhood dream career?",
    "What is your grandmother's first name?, What was your favourite video game growing up?, What is your favourite colour?",
    "What was the name of your elementary school?, What is your favourite band or musician?, What is your favourite drink?",
    "What was your childhood phone number (landline)?, What is the name of your favourite fictional character?, What is your favourite board game?",
    "What is the name of the street you live on now?, What was your favourite toy as a child?, What is your all-time favourite meal?",
    "What is your favourite childhood memory location?, What was the name of your first pet's vet?, What is your favourite quote?",
    "What was your college roommate's name?, What is your favourite ice cream flavour?, What was your first email address (username only)?",
    "What is the name of a place you'd love to visit?, What was your favourite cartoon growing up?, What is your favourite number?",
    "What was your first bicycle's colour?, What is your favourite family recipe?, What was your childhood address's zip/postal code?",
    "Who is your favourite author?, What was the name of your childhood dog or cat?, What is the middle name of your oldest sibling?",
    "What was the first foreign country you visited?, What is your favourite type of music?, What was your favourite childhood snack?",
    "What is the name of the church, mosque, or temple you attended growing up?, What was your favourite class project?, What is your favourite hobby?",
]