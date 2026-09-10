const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const OpenAI = require('openai');
const schemes = require('./data/schemes.json');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

function matchSchemes(profile) {
    const searchText = `${profile.occupation} ${profile.category} ${profile.gender} ${profile.income}`.toLowerCase();
    const matched = schemes.filter(scheme => {
        const schemeText = scheme.keywords.join(' ').toLowerCase();
        return schemeText.split(' ').some(word => word.length > 2 && searchText.includes(word));
    });
    return matched.length > 0 ? matched : schemes.slice(0, 5);
}

function getMissingFields(profile, language) {
    const fields = [];
    if (!profile.age) fields.push(language === 'tamil' ? 'வயது' : 'age');
    if (!profile.occupation) fields.push(language === 'tamil' ? 'தொழில்' : 'occupation');
    if (!profile.income) fields.push(language === 'tamil' ? 'வருமானம்' : 'annual family income');
    if (!profile.category) fields.push(language === 'tamil' ? 'சமூக வகை' : 'social category (General/SC/ST/OBC)');
    if (!profile.gender) fields.push(language === 'tamil' ? 'பாலினம்' : 'gender');
    return fields;
}

function getOptionsForStep(profile, language) {
    if (!profile.age) return null;

    if (!profile.occupation) return language === 'tamil' ? [
        { label: '🎓 மாணவர்', value: 'student' },
        { label: '🌾 விவசாயி', value: 'farmer' },
        { label: '💼 வேலையாள்', value: 'employed' },
        { label: '🏪 தொழிலதிபர்', value: 'entrepreneur' },
        { label: '🏠 இல்லத்தரசி', value: 'homemaker' },
        { label: '❌ வேலையில்லாதவர்', value: 'unemployed' },
        { label: '👴 மூத்த குடிமகன்', value: 'senior' }
    ] : [
        { label: '🎓 Student', value: 'student' },
        { label: '🌾 Farmer', value: 'farmer' },
        { label: '💼 Employed', value: 'employed' },
        { label: '🏪 Entrepreneur', value: 'entrepreneur' },
        { label: '🏠 Homemaker', value: 'homemaker' },
        { label: '❌ Unemployed', value: 'unemployed' },
        { label: '👴 Senior Citizen', value: 'senior' }
    ];

    if (!profile.income) return language === 'tamil' ? [
        { label: '₹1 லட்சத்திற்கு கீழ்', value: 'below 1 lakh' },
        { label: '₹1 - ₹2 லட்சம்', value: '1 to 2 lakh' },
        { label: '₹2 - ₹5 லட்சம்', value: '2 to 5 lakh' },
        { label: '₹5 - ₹10 லட்சம்', value: '5 to 10 lakh' },
        { label: '₹10 லட்சத்திற்கு மேல்', value: 'above 10 lakh' }
    ] : [
        { label: 'Below ₹1 Lakh', value: 'below 1 lakh' },
        { label: '₹1 - ₹2 Lakh', value: '1 to 2 lakh' },
        { label: '₹2 - ₹5 Lakh', value: '2 to 5 lakh' },
        { label: '₹5 - ₹10 Lakh', value: '5 to 10 lakh' },
        { label: 'Above ₹10 Lakh', value: 'above 10 lakh' }
    ];

    if (!profile.category) return [
        { label: 'General', value: 'general' },
        { label: 'OBC', value: 'obc' },
        { label: 'SC', value: 'sc' },
        { label: 'ST', value: 'st' }
    ];

    if (!profile.gender) return language === 'tamil' ? [
        { label: '👨 ஆண்', value: 'male' },
        { label: '👩 பெண்', value: 'female' },
        { label: '🧑 மற்றவை', value: 'other' }
    ] : [
        { label: '👨 Male', value: 'male' },
        { label: '👩 Female', value: 'female' },
        { label: '🧑 Other', value: 'other' }
    ];

    return null;
}

function getFollowupOptions(language) {
    return language === 'tamil' ? [
        { label: '📄 என்ன ஆவணங்கள் தேவை?', value: 'என்ன ஆவணங்கள் தேவை?' },
        { label: '✅ நான் தகுதியானவனா?', value: 'நான் இந்த திட்டங்களுக்கு தகுதியானவனா?' },
        { label: '📝 எப்படி விண்ணப்பிப்பது?', value: 'இந்த திட்டங்களுக்கு எப்படி விண்ணப்பிப்பது?' },
        { label: '🔄 மீண்டும் தொடங்கு', value: 'RESTART' }
    ] : [
        { label: '📄 What documents do I need?', value: 'What documents do I need?' },
        { label: '✅ Am I eligible?', value: 'Am I fully eligible for these schemes?' },
        { label: '📝 How do I apply?', value: 'How do I apply step by step?' },
        { label: '🔄 Start Over', value: 'RESTART' }
    ];
}

app.post('/api/chat', async (req, res) => {
    const { message, profile, step, history, language = 'english' } = req.body;
    const isTamil = language === 'tamil';

    console.log(`Language: ${language}, Step: ${step}`);

    try {
        let systemPrompt = '';
        let userPrompt = '';
        let responseData = {};

        // SYSTEM PROMPT — locks language at model level
        systemPrompt = isTamil
            ? 'நீங்கள் ENTITLE AI — இந்திய அரசு திட்டங்களை கண்டுபிடிக்க உதவும் நட்பான உதவியாளர். நீங்கள் எப்போதும் தமிழிலேயே பதில் அளிக்க வேண்டும். பயனர் ஆங்கிலத்தில் எழுதினாலும் சரி, எண்களில் எழுதினாலும் சரி — உங்கள் பதில் 100% தமிழில் மட்டுமே இருக்க வேண்டும். ஒரு வார்த்தை கூட ஆங்கிலத்தில் எழுதக்கூடாது.'
            : 'You are ENTITLE AI — a friendly assistant helping Indian citizens find government schemes they are eligible for. Always respond in English only. Never switch to Tamil or any other language. Be warm, simple, and conversational.';

        if (step === 'collecting') {
            const missing = getMissingFields(profile, language);
            const options = getOptionsForStep(profile, language);

            userPrompt = isTamil
                ? `இதுவரை சேகரிக்கப்பட்ட தகவல்கள்: ${JSON.stringify(profile)}
தேவையான தகவல்கள்: ${missing.join(', ')}

வழிமுறைகள்:
- ஒரே ஒரு கேள்வி மட்டும் கேளுங்கள்
- எளிமையான தமிழில் பேசுங்கள்
- 2-3 வரிகள் மட்டும்
- முதல் தேவையான தகவலை மட்டும் கேளுங்கள்
- திட்டங்களை இப்போது கூறாதீர்கள்

பயனர் கூறியது: "${message}"`
                : `Profile so far: ${JSON.stringify(profile)}
Missing fields: ${missing.join(', ')}

Rules:
- Ask ONE question only
- Be warm and conversational
- Keep it SHORT (2-3 lines max)
- Ask for the FIRST missing field only
- Do NOT list schemes yet

User said: "${message}"`;

            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 200,
                temperature: 0.7,
            });

            const text = completion.choices[0].message.content;

            responseData = {
                message: text,
                options,
                schemes: null,
                done: false
            };

        } else if (step === 'complete') {
            const matched = matchSchemes(profile);

            userPrompt = isTamil
                ? `பயனர் விவரங்கள்:
- வயது: ${profile.age}
- தொழில்: ${profile.occupation}
- வருமானம்: ${profile.income}
- வகை: ${profile.category}
- பாலினம்: ${profile.gender}

கண்டுபிடிக்கப்பட்ட திட்டங்கள்: ${matched.map(s => s.name).join(', ')}

வழிமுறைகள்:
- மகிழ்ச்சியான தொனியில் பதில் அளியுங்கள்
- எத்தனை திட்டங்கள் கண்டுபிடிக்கப்பட்டன என்று கூறுங்கள்
- 2-3 வரிகள் மட்டும்
- கீழே உள்ள அட்டைகளில் முழு விவரங்கள் உள்ளன என்று கூறுங்கள்`
                : `User Profile:
- Age: ${profile.age}
- Occupation: ${profile.occupation}
- Income: ${profile.income}
- Category: ${profile.category}
- Gender: ${profile.gender}

Matched schemes: ${matched.map(s => s.name).join(', ')}

Rules:
- Be warm and celebratory
- Mention how many schemes were found
- Keep it SHORT (2-3 lines)
- Tell them the cards below show full details`;

            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 200,
                temperature: 0.7,
            });

            const text = completion.choices[0].message.content;

            responseData = {
                message: text,
                schemes: matched,
                options: getFollowupOptions(language),
                done: true
            };

        } else if (step === 'followup') {
            const matched = matchSchemes(profile);
            const schemeDetails = matched.map(s =>
                `${s.name}: Benefit: ${s.benefit}, Eligibility: ${s.eligibility.join(', ')}, Documents: ${s.documents.join(', ')}, Apply: ${s.howToApply}`
            ).join('\n');

            userPrompt = isTamil
                ? `பயனர் விவரங்கள்: ${JSON.stringify(profile)}

திட்ட விவரங்கள்:
${schemeDetails}

உரையாடல் வரலாறு: ${JSON.stringify(history?.slice(-4))}

பயனர் கேட்டது: "${message}"

எளிமையான தமிழில் தெளிவான பதில் அளியுங்கள்.`
                : `User Profile: ${JSON.stringify(profile)}

Scheme Details:
${schemeDetails}

Conversation: ${JSON.stringify(history?.slice(-4))}

User asked: "${message}"

Answer clearly and simply in English. Give specific details from scheme data above.`;

            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 400,
                temperature: 0.7,
            });

            const text = completion.choices[0].message.content;

            responseData = {
                message: text,
                schemes: null,
                options: getFollowupOptions(language),
                done: false
            };
        }

        res.json(responseData);

    } catch (error) {
        console.error('OpenAI error:', error.message);
        res.status(500).json({
            error: isTamil
                ? 'பிழை ஏற்பட்டது. API key சரிபார்க்கவும்.'
                : 'AI error. Check your API key.'
        });
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`✅ ENTITLE AI backend running on port ${PORT}`));