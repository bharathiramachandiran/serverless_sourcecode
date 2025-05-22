const REGEX_PATTERN = {

    USER_NAME_REGEX: "^[a-zA-Z]+([ ][a-zA-Z]+)*$",

    LOCATION_NAME_REGEX: "^[\\p{L}0-9,.\\s]+$",

    CURRENT_POSITION: "^[a-zA-Z\\/\\\\ ]+([ ][a-zA-Z ]+)*$",

    LATITUDE_REGEX: "^([-+]?)([0-9]|[1-8][0-9]|90)(\\.\\d{1,6})?$",

    LONGITUDE_REGEX: "^([-+]?)([0-9]|[1-9][0-9]|1[0-7][0-9]|180)(\\.\\d{1,6})?$",

    ROLE_REGEX: "^(JOBSEEKER|EMPLOYER|ADMIN)$",

    UUID_REGEX: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",

    EMAIL_REGEX: "^[a-zA-Z0-9_+&*-]+(?:\\.[a-zA-Z0-9_+&*-]+)*@(?:[a-zA-Z0-9-]+\\.)+[a-zA-Z]{2,7}$",

    BIRTHDATE_REGEX: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$",

    GENDER_REGEX: "^(male|female)$",

    SMS_CODE_REGEX: "\\d{6}$",

    PASSWORD_REGEX: "^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[@#$%^&+=!]).{8,}$",

    FILENAME_REGEX: "^[a-zA-Z0-9\\s,.'_\\-@#&]{5,}$",

    IMAGE_FORMAT_REGEX: "^(jpeg|png|doc|docx|pdf)$",

    IMAGE_FORMAT_REGEX_FOR_REUME_UPLOAD: "^(jpeg|jpg|png|doc|docx|pdf)$",

    JOB_STATUS_REGEX: "^(EMPLOYED|OPEN|READY)$",

     TAX_ID_REGEX: "^\\d{2}-\\d{7}$",

    // LICENSE_REGEX: "^[A-Za-z]{0,2}\d{4,8}$",

    SAFE_STRING_REGEX: "^[a-zA-Z.]+([',//\". \\-]+[a-zA-Z.]+)*$",

    TIME_STAMP_REGEX: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\+\\d{4}$",

    MOBILE_NO_REGEX: "^\\+",

    PHONE_REGEX: "^\\+1\\d{10}$",

    FCM_TOKEN_REGEX: "^[a-zA-Z0-9-_=+]+(.?:[a-zA-Z0-9-_=+]+)*$",

    URL_REGEX: "^(https?:\\/\\/)?(www\\.)?[a-zA-Z0-9-]+(\\.[a-zA-Z]{2,})+(\\/[^\\s]*)?(\\?[^\\s]*)?$",

    JOB_APPLICATION_STATUS_REGEX: "^(APPLIED|PROCESSING|SHORTLISTED|INTERVIEW|SELECTED|NOT_SUITABLE|DECLINED)$",

    COMPANY_SIZE_REGEX: "^[1-9]\\d*$$",

    USER_STATUS_REGEX: "^(APPROVED|SUSPEND|PAUSE)$",

    JOB_POSTING_STATUS_REGEX: "^(DRAFT|POSTED|APPROVED|PUBLISHED|REPOSTED|PAUSED|CANCELLED|DELETED)$",

    COMPANY_STATUS_REGEX: "^(CREATED|DOCUMENTS_RECEIVED|INVALID_POEA|APPROVED|PAUSED|DELETED)$",

    COMPANY_NAME: "^[a-zA-Z0-9 .-]*$",
    
    SUBSCRIBTION_TOPIC: "^(DAILY_NEW_APPLICANT|BUSINESS_EMAIL|DAILY_NEW_JOB_POSTING)$",

    ISO_DATE_FORMAT: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",

    POEA_DOCUMENT_TYPE: "^(DMW_JOB_ORDER|DMW_MANPOWER_POOLING|DMW_LICENSE)$",
};

export default REGEX_PATTERN;