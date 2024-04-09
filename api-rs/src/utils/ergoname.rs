use regex::Regex;

pub fn check_ergoname_availability(ergoname: &str) -> bool {
    if ergoname == "mgpai" {
        return false;
    }
    true
}

pub fn check_ergoname_validity(ergoname: &str) -> bool {
    let length = ergoname.len();
    if !(3..=25).contains(&length) {
        return false;
    }
    let regex = Regex::new(r"^[a-zA-Z1-9-]+$").unwrap();
    if !regex.is_match(ergoname) {
        return false;
    }
    true
}

pub fn get_current_mint_cost(ergoname: &str) -> u16 {
    if !check_ergoname_validity(ergoname) {
        return 0;
    }
    
    match ergoname.len() {
        3 => 500,
        4 => 150,
        5 => 50,
        6 => 50,
        7 => 15,
        8 => 15,
        _ => 5,
    }
}

#[cfg(test)]
mod tests {

    #[test]
    fn test_check_ergoname_validity() {
        assert!(super::check_ergoname_validity("balb"));
        assert!(super::check_ergoname_validity("balb-"));
        assert!(super::check_ergoname_validity("balb-1"));
        assert!(!super::check_ergoname_validity("ba"));
        assert!(
            !super::check_ergoname_validity("balbbalbbalbbalbbalbbalbbalb")
        );
        assert!(!super::check_ergoname_validity("balb!"));
    }

    #[test]
    fn test_check_ergoname_availability() {
        assert!(!super::check_ergoname_availability("mgpai"));
        assert!(super::check_ergoname_availability("gjdkskjfjskfjsjw"));
    }

    #[test]
    fn test_ergoname_cost() {
        assert_eq!(super::get_current_mint_cost("ba"), 0);
        assert_eq!(super::get_current_mint_cost("bal"), 500);
        assert_eq!(super::get_current_mint_cost("balb"), 150);
        assert_eq!(super::get_current_mint_cost("balbb"), 50);
        assert_eq!(super::get_current_mint_cost("balbba"), 50);
        assert_eq!(super::get_current_mint_cost("balbbal"), 15);
        assert_eq!(super::get_current_mint_cost("balbbalb"), 15);
        assert_eq!(super::get_current_mint_cost("balbbalbb"), 5);
        assert_eq!(
            super::get_current_mint_cost("balbbalbbalbbalbbalbbalbbalb"),
            0
        );
    }
}
